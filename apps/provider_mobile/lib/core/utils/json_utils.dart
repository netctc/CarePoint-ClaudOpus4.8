import 'package:intl/intl.dart';

Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, value) => MapEntry(key.toString(), value));
  return <String, dynamic>{};
}

List<Map<String, dynamic>> asMapList(dynamic value) {
  if (value is! List) return <Map<String, dynamic>>[];
  return value.map<Map<String, dynamic>>((dynamic item) => asMap(item)).toList();
}

Map<String, dynamic> pickMap(dynamic source, List<String> keys) {
  final Map<String, dynamic> map = asMap(source);
  for (final String key in keys) {
    final dynamic value = map[key];
    if (value is Map || value is Map<String, dynamic>) {
      return asMap(value);
    }
  }
  return map;
}

List<Map<String, dynamic>> pickList(dynamic source, List<String> keys) {
  if (source is List) return asMapList(source);
  final Map<String, dynamic> map = asMap(source);
  for (final String key in keys) {
    final dynamic value = map[key];
    if (value is List) return asMapList(value);
  }
  return <Map<String, dynamic>>[];
}

String readString(dynamic source, List<String> keys, {String fallback = '—'}) {
  final Map<String, dynamic> map = asMap(source);
  for (final String key in keys) {
    final dynamic value = map[key];
    if (value != null && value.toString().trim().isNotEmpty) {
      return value.toString().trim();
    }
  }
  return fallback;
}

int readInt(dynamic source, List<String> keys, {int fallback = 0}) {
  final Map<String, dynamic> map = asMap(source);
  for (final String key in keys) {
    final dynamic value = map[key];
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) return int.tryParse(value) ?? fallback;
  }
  return fallback;
}

bool readBool(dynamic source, List<String> keys, {bool fallback = false}) {
  final Map<String, dynamic> map = asMap(source);
  for (final String key in keys) {
    final dynamic value = map[key];
    if (value is bool) return value;
    if (value is String) {
      final String normalized = value.toLowerCase().trim();
      if (normalized == 'true') return true;
      if (normalized == 'false') return false;
    }
  }
  return fallback;
}

String titleCaseKey(String value) {
  return value
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .split(' ')
      .where((part) => part.trim().isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}

String formatDateTimeLabel(dynamic value) {
  if (value == null) return '—';
  final DateTime? parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('dd MMM yyyy • hh:mm a').format(parsed.toLocal());
}

String formatDateLabel(dynamic value) {
  if (value == null) return '—';
  final DateTime? parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('dd MMM yyyy').format(parsed.toLocal());
}
