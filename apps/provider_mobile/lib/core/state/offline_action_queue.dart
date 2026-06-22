import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/provider_api_service.dart';

class OfflineActionQueue extends ChangeNotifier {
  OfflineActionQueue._();

  static final OfflineActionQueue instance = OfflineActionQueue._();
  static const String _storageKey = 'carepoint.provider.offline_actions';

  final List<Map<String, dynamic>> _items = <Map<String, dynamic>>[];
  ProviderApiService? _api;
  bool _initialized = false;
  bool _processing = false;

  bool get isInitialized => _initialized;
  bool get isProcessing => _processing;
  int get pendingCount => _items.where((Map<String, dynamic> item) => _isPendingLike(item)).length;
  List<Map<String, dynamic>> get items => List<Map<String, dynamic>>.unmodifiable(_items);

  Future<void> init(ProviderApiService api) async {
    _api = api;
    if (_initialized) return;
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    final String? raw = preferences.getString(_storageKey);
    if (raw != null && raw.trim().isNotEmpty) {
      try {
        final dynamic decoded = jsonDecode(raw);
        if (decoded is List) {
          _items
            ..clear()
            ..addAll(decoded.whereType<dynamic>().map<Map<String, dynamic>>((dynamic item) => Map<String, dynamic>.from(item as Map)));
        }
      } catch (_) {}
    }
    _initialized = true;
    notifyListeners();
  }

  Future<void> enqueue({
    required String type,
    required String title,
    required Map<String, dynamic> payload,
    String? patientId,
    String? patientName,
    String? resourceId,
    List<Map<String, dynamic>> attachments = const <Map<String, dynamic>>[],
  }) async {
    final Map<String, dynamic> item = <String, dynamic>{
      'id': DateTime.now().microsecondsSinceEpoch.toString(),
      'type': type,
      'title': title,
      'patientId': patientId,
      'patientName': patientName,
      'resourceId': resourceId,
      'payload': payload,
      'attachments': attachments,
      'status': 'pending',
      'retryCount': 0,
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'updatedAt': DateTime.now().toUtc().toIso8601String(),
      'lastError': null,
    };
    _items.insert(0, item);
    await _persist();
    notifyListeners();
  }

  Future<void> remove(String id) async {
    _items.removeWhere((Map<String, dynamic> item) => _readString(item['id']) == id);
    await _persist();
    notifyListeners();
  }

  Future<void> clearCompleted() async {
    _items.removeWhere((Map<String, dynamic> item) => _readString(item['status']) == 'completed');
    await _persist();
    notifyListeners();
  }

  Future<void> retryOne(String id) async {
    final int index = _items.indexWhere((Map<String, dynamic> item) => _readString(item['id']) == id);
    if (index < 0) return;
    await _executeAt(index);
  }

  Future<void> processAll() async {
    if (_processing) return;
    _processing = true;
    notifyListeners();
    try {
      for (int i = 0; i < _items.length; i++) {
        if (_isPendingLike(_items[i])) {
          await _executeAt(i);
        }
      }
    } finally {
      _processing = false;
      notifyListeners();
    }
  }

  Future<void> _executeAt(int index) async {
    if (_api == null || index < 0 || index >= _items.length) return;
    final Map<String, dynamic> item = _items[index];
    item['status'] = 'processing';
    item['updatedAt'] = DateTime.now().toUtc().toIso8601String();
    await _persist();
    notifyListeners();

    try {
      await _dispatch(_api!, item);
      item['status'] = 'completed';
      item['lastError'] = null;
    } catch (error) {
      item['status'] = 'failed';
      item['lastError'] = error.toString();
      item['retryCount'] = (item['retryCount'] is num ? item['retryCount'] as num : 0) + 1;
    } finally {
      item['updatedAt'] = DateTime.now().toUtc().toIso8601String();
      await _persist();
      notifyListeners();
    }
  }

  Future<void> _dispatch(ProviderApiService api, Map<String, dynamic> item) async {
    final String type = _readString(item['type']);
    final Map<String, dynamic> payload = item['payload'] is Map<String, dynamic>
        ? Map<String, dynamic>.from(item['payload'] as Map<String, dynamic>)
        : Map<String, dynamic>.from(item['payload'] as Map);

    switch (type) {
      case 'encounter_sign':
        await api.signEncounterNote(payload);
        return;
      case 'order_create_draft':
        await api.createOrderDraft(payload);
        return;
      case 'order_create_and_submit':
        final Map<String, dynamic> created = await api.createOrderDraft(payload);
        final dynamic raw = created['item'] ?? created['data'];
        final Map<String, dynamic> map = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
        final String id = _readString(map['id']);
        if (id.isNotEmpty) {
          await api.submitOrder(id, note: _readString(payload['note']));
        }
        return;
      case 'prescription_create_draft':
        await api.createPrescriptionDraft(payload);
        return;
      case 'prescription_create_and_sign':
        final Map<String, dynamic> created = await api.createPrescriptionDraft(payload);
        final dynamic raw = created['item'] ?? created['data'];
        final Map<String, dynamic> map = raw is Map ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
        final String id = _readString(map['id']);
        if (id.isNotEmpty) {
          await api.signPrescription(id, note: _readString(payload['note']));
        }
        return;
      case 'refill_review':
        await api.reviewRefillRequest(_readString(item['resourceId']), payload);
        return;
      case 'refill_assign':
        await api.assignRefillRequest(_readString(item['resourceId']), payload);
        return;
      case 'refill_escalate':
        await api.escalateRefillRequest(_readString(item['resourceId']), payload);
        return;
      default:
        throw StateError('Unknown offline action type: $type');
    }
  }

  Future<void> _persist() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setString(_storageKey, jsonEncode(_items));
  }

  static bool looksRetryableMutationError(Object error) {
    final String message = error.toString().toLowerCase();
    const List<String> patterns = <String>[
      'socketexception',
      'clientexception',
      'failed host lookup',
      'connection refused',
      'network',
      'timeout',
      'xmlhttprequest',
      'failed to fetch',
      'err_failed',
    ];
    return patterns.any(message.contains);
  }

  bool _isPendingLike(Map<String, dynamic> item) {
    final String status = _readString(item['status']);
    return status == 'pending' || status == 'failed';
  }

  String _readString(dynamic value) => value?.toString().trim() ?? '';
}
