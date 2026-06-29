import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/draft_attachment_editor.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderOrderComposerPage extends StatefulWidget {
  const ProviderOrderComposerPage({
    this.patientId,
    this.appointmentId,
    this.patientName,
    this.subjectProfileId,
    this.subjectLabel,
    this.subjectRelationship,
    super.key,
  });

  final String? patientId;
  final String? appointmentId;
  final String? patientName;
  final String? subjectProfileId;
  final String? subjectLabel;
  final String? subjectRelationship;

  @override
  State<ProviderOrderComposerPage> createState() => _ProviderOrderComposerPageState();
}

class _ProviderOrderComposerPageState extends State<ProviderOrderComposerPage> {
  late Future<Map<String, dynamic>> _future;
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();
  String _requestedBy = ProviderSession.instance.categoryLabel;
  String _patientId = '';
  String _patientName = '';
  String? _subjectProfileId;
  String? _subjectLabel;
  String? _subjectRelationship;
  final Set<String> _selectedItems = <String>{};
  List<Map<String, dynamic>> _attachments = <Map<String, dynamic>>[];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _patientId = widget.patientId ?? '';
    _patientName = widget.patientName ?? widget.subjectLabel ?? '';
    _subjectProfileId = widget.subjectProfileId;
    _subjectLabel = widget.subjectLabel;
    _subjectRelationship = widget.subjectRelationship;
    _future = _load();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async {
    if (_patientId.isEmpty && (widget.appointmentId == null || widget.appointmentId!.isEmpty)) {
      return <String, dynamic>{};
    }
    final Map<String, dynamic> response = await ProviderSession.instance.api.orderComposerContext(
      patientId: _patientId.isEmpty ? null : _patientId,
      appointmentId: widget.appointmentId,
    );
    final Map<String, dynamic> item = pickMap(response, const <String>['item', 'data']);
    _patientId = readString(item, const <String>['patientId'], fallback: _patientId);
    _patientName = readString(item, const <String>['patientName'], fallback: _patientName);
    _subjectProfileId ??= readString(item, const <String>['subjectProfileId'], fallback: '');
    _subjectLabel ??= readString(item, const <String>['subjectLabel'], fallback: '');
    _subjectRelationship ??= readString(item, const <String>['subjectRelationship'], fallback: '');
    _requestedBy = readString(item, const <String>['requestedBy'], fallback: _requestedBy);
    if (_reasonController.text.trim().isEmpty) {
      _reasonController.text = readString(item, const <String>['reason'], fallback: 'Clinical follow-up');
    }
    for (final Map<String, dynamic> existing in pickList(item, const <String>['orderGroups'])) {
      final String title = readString(existing, const <String>['title'], fallback: '');
      if (title.isNotEmpty && title != '—') {
        _selectedItems.add(title);
      }
    }
    return response;
  }

  void _refresh() => setState(() => _future = _load());

  Map<String, dynamic> _buildPayload(bool submit) {
    final List<String> selections = _selectedItems.toList();
    return <String, dynamic>{
      'patientId': _patientId,
      'patientName': _subjectLabel?.trim().isNotEmpty == true ? _subjectLabel!.trim() : _patientName,
      'appointmentId': widget.appointmentId,
      'encounterId': widget.appointmentId,
      'reason': _reasonController.text.trim().isEmpty ? 'Clinical follow-up' : _reasonController.text.trim(),
      'requestedBy': _requestedBy,
      'commonSelections': selections,
      'orderGroups': selections
          .map((String item) => <String, dynamic>{
                'title': item,
                'description': 'Requested from provider mobile clinical workflow.',
                'status': submit ? 'Submitted' : 'Requested',
                'variant': submit ? 'success' : 'info',
              })
          .toList(),
      'note': _noteController.text.trim(),
      'subjectProfileId': _subjectProfileId,
      'subjectLabel': _subjectLabel,
      'subjectRelationship': _subjectRelationship,
      if (_attachments.isNotEmpty) 'attachments': _attachments,
    };
  }

  Future<void> _save({required bool submit}) async {
    if (_patientId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('A patient context is required before creating a clinical order.')));
      return;
    }

    final Map<String, dynamic> payload = _buildPayload(submit);
    setState(() => _saving = true);
    try {
      final Map<String, dynamic> created = await ProviderSession.instance.api.createOrderDraft(payload);
      final Map<String, dynamic> item = pickMap(created, const <String>['item', 'data']);
      final String id = readString(item, const <String>['id'], fallback: '');
      if (submit && id.isNotEmpty && id != '—') {
        await ProviderSession.instance.api.submitOrder(id, note: _noteController.text.trim());
      }
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(submit ? 'Clinical order submitted.' : 'Clinical order draft saved.')));
      if (id.isNotEmpty && id != '—') {
        context.go('/orders/$id');
      } else {
        _refresh();
      }
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(
          type: submit ? 'order_create_and_submit' : 'order_create_draft',
          title: 'Clinical order for ${_subjectLabel ?? (_patientName.isNotEmpty ? _patientName : _patientId)}',
          payload: payload,
          patientId: _patientId,
          patientName: _subjectLabel ?? _patientName,
          attachments: _attachments,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection issue detected. The order was added to the offline queue.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'data']);
        final List<Map<String, dynamic>> recentRecords = pickList(item, const <String>['recentRecords', 'records']);
        final List<dynamic> commonSelections = item['commonSelections'] is List ? item['commonSelections'] as List<dynamic> : const <dynamic>[];
        final String chartRoute = buildAppRoute(
          '/chart/${_patientId.isEmpty ? widget.patientId ?? '' : _patientId}',
          queryParameters: <String, String?>{
            'patientName': _patientName,
            'subjectProfileId': _subjectProfileId,
            'subjectLabel': _subjectLabel,
            'subjectRelationship': _subjectRelationship,
          },
        );

        return SafeArea(
          top: false,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            children: <Widget>[
              ProviderHeroCard(
                title: _patientName.isEmpty ? 'New clinical order' : 'New order for $_patientName',
                subtitle: 'Capture lab, imaging, and referral requests with encounter context and draft/submit controls.',
                badge: _subjectRelationship?.trim().isNotEmpty == true ? _subjectRelationship!.trim() : 'Clinical order',
              ),
              const SizedBox(height: 20),
              ProviderCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    _InfoRow(label: 'Patient ID', value: _patientId.isEmpty ? '—' : _patientId),
                    _InfoRow(label: 'Patient', value: _patientName.isEmpty ? '—' : _patientName),
                    _InfoRow(label: 'Appointment ID', value: widget.appointmentId ?? '—'),
                    _InfoRow(label: 'Requested by', value: _requestedBy),
                    if (_patientId.isNotEmpty)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton.icon(
                          onPressed: () => context.go(chartRoute),
                          icon: const Icon(Icons.folder_shared_rounded),
                          label: const Text('Back to chart'),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ProviderCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text('Order details', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _reasonController,
                      decoration: const InputDecoration(labelText: 'Reason for order'),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _noteController,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'Clinical note'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              DraftAttachmentEditor(
                attachments: _attachments,
                onChanged: (List<Map<String, dynamic>> value) => setState(() => _attachments = value),
                title: 'Attachment staging',
                subtitle: 'Stage order-related evidence or secure links locally for mobile handoff while upload endpoints are being completed.',
              ),
              const SizedBox(height: 16),
              const SectionTitle(title: 'Common selections'),
              const SizedBox(height: 12),
              ProviderCard(
                child: Column(
                  children: <Widget>[
                    if (commonSelections.isEmpty)
                      const Text('No common selections were returned for this patient context.')
                    else
                      for (final dynamic item in commonSelections)
                        CheckboxListTile(
                          contentPadding: EdgeInsets.zero,
                          value: _selectedItems.contains(item.toString()),
                          title: Text(item.toString()),
                          onChanged: (bool? value) {
                            setState(() {
                              if (value == true) {
                                _selectedItems.add(item.toString());
                              } else {
                                _selectedItems.remove(item.toString());
                              }
                            });
                          },
                        ),
                  ],
                ),
              ),
              if (recentRecords.isNotEmpty) ...<Widget>[
                const SizedBox(height: 16),
                const SectionTitle(title: 'Recent chart context'),
                const SizedBox(height: 12),
                ProviderCard(
                  child: Column(
                    children: recentRecords.take(3).map((Map<String, dynamic> record) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: <Widget>[
                            const Icon(Icons.description_outlined),
                            const SizedBox(width: 10),
                            Expanded(child: Text(readString(record, const <String>['title', 'summaryTitle', 'recordType'], fallback: 'Clinical record'))),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _saving ? null : () => _save(submit: false),
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('Save draft'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _saving ? null : () => _save(submit: true),
                      icon: const Icon(Icons.send_rounded),
                      label: const Text('Submit order'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}
