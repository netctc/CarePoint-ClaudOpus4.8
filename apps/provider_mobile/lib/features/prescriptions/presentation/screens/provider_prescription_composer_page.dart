import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/draft_attachment_editor.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderPrescriptionComposerPage extends StatefulWidget {
  const ProviderPrescriptionComposerPage({
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
  State<ProviderPrescriptionComposerPage> createState() => _ProviderPrescriptionComposerPageState();
}

class _ProviderPrescriptionComposerPageState extends State<ProviderPrescriptionComposerPage> {
  final TextEditingController _drugController = TextEditingController();
  final TextEditingController _dosageController = TextEditingController();
  final TextEditingController _frequencyController = TextEditingController();
  final TextEditingController _durationController = TextEditingController();
  final TextEditingController _pharmacyController = TextEditingController();
  final TextEditingController _noteController = TextEditingController();

  Map<String, dynamic>? _preview;
  bool _saving = false;
  List<Map<String, dynamic>> _attachments = <Map<String, dynamic>>[];

  String _patientId = '';
  String _patientName = '';
  String? _subjectProfileId;
  String? _subjectLabel;
  String? _subjectRelationship;

  @override
  void initState() {
    super.initState();
    _patientId = widget.patientId ?? '';
    _patientName = widget.patientName ?? widget.subjectLabel ?? '';
    _subjectProfileId = widget.subjectProfileId;
    _subjectLabel = widget.subjectLabel;
    _subjectRelationship = widget.subjectRelationship;
    _frequencyController.text = 'Once daily';
    _durationController.text = '30 days';
  }

  @override
  void dispose() {
    _drugController.dispose();
    _dosageController.dispose();
    _frequencyController.dispose();
    _durationController.dispose();
    _pharmacyController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _previewCompliance() async {
    if (_drugController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a medication name first.')));
      return;
    }

    setState(() => _saving = true);
    try {
      final Map<String, dynamic> response = await ProviderSession.instance.api.compliancePreview(
        drug: _drugController.text.trim(),
        pharmacyName: _pharmacyController.text.trim().isEmpty ? null : _pharmacyController.text.trim(),
      );
      setState(() => _preview = pickMap(response, const <String>['item', 'data']));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Map<String, dynamic> _buildPayload() {
    final List<String> guidance = _preview?['guidance'] is List ? (_preview!['guidance'] as List<dynamic>).map((dynamic item) => item.toString()).toList() : const <String>[];
    final bool controlledMedication = readBool(_preview, const <String>['controlledMedication']);
    final bool refillEligible = readBool(_preview?['refillPolicy'], const <String>['refillEligible'], fallback: !controlledMedication);
    final int refillMaxCount = readInt(_preview?['refillPolicy'], const <String>['refillMaxCount'], fallback: controlledMedication ? 0 : 1);

    return <String, dynamic>{
      'patientId': _patientId,
      'patientName': _subjectLabel?.trim().isNotEmpty == true ? _subjectLabel!.trim() : _patientName,
      'appointmentId': widget.appointmentId,
      'drug': _drugController.text.trim(),
      'dosage': _dosageController.text.trim(),
      'frequency': _frequencyController.text.trim().isEmpty ? 'Once daily' : _frequencyController.text.trim(),
      'duration': _durationController.text.trim().isEmpty ? '30 days' : _durationController.text.trim(),
      'pharmacyName': _pharmacyController.text.trim(),
      'note': _noteController.text.trim(),
      'controlledMedication': controlledMedication,
      'refillEligible': refillEligible,
      'refillMaxCount': refillMaxCount,
      'shortcuts': <String>['30-day supply', 'Once daily', 'Twice daily'],
      'complianceChecks': guidance
          .map((String message) => <String, dynamic>{
                'label': controlledMedication ? 'Controlled medication policy' : 'Medication routing',
                'detail': message,
                'status': controlledMedication ? 'Review' : 'Ready',
                'variant': controlledMedication ? 'warning' : 'success',
              })
          .toList(),
      'subjectProfileId': _subjectProfileId,
      'subjectLabel': _subjectLabel,
      'subjectRelationship': _subjectRelationship,
      if (_attachments.isNotEmpty) 'attachments': _attachments,
    };
  }

  Future<void> _save({required bool sign}) async {
    if (_patientId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Open the composer from a patient chart or appointment context.')));
      return;
    }
    if (_drugController.text.trim().isEmpty || _dosageController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Medication name and dosage are required.')));
      return;
    }

    final Map<String, dynamic> payload = _buildPayload();
    setState(() => _saving = true);
    try {
      final Map<String, dynamic> created = await ProviderSession.instance.api.createPrescriptionDraft(payload);
      final Map<String, dynamic> item = pickMap(created, const <String>['item', 'data']);
      final String id = readString(item, const <String>['id'], fallback: '');
      if (sign && id.isNotEmpty && id != '—') {
        await ProviderSession.instance.api.signPrescription(id, note: _noteController.text.trim());
      }
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(sign ? 'Prescription signed and released.' : 'Prescription draft saved.')));
      if (id.isNotEmpty && id != '—') {
        context.go('/prescriptions/$id');
      }
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(
          type: sign ? 'prescription_create_and_sign' : 'prescription_create_draft',
          title: 'Prescription for ${_subjectLabel ?? (_patientName.isNotEmpty ? _patientName : _patientId)}',
          payload: payload,
          patientId: _patientId,
          patientName: _subjectLabel ?? _patientName,
          attachments: _attachments,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection issue detected. The prescription was added to the offline queue.')),
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
    final List<dynamic> guidance = _preview?['guidance'] is List ? (_preview!['guidance'] as List<dynamic>) : const <dynamic>[];
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
            title: _patientName.isEmpty ? 'New prescription' : 'New prescription for $_patientName',
            subtitle: 'Draft the medication, preview compliance guidance, then sign to release it to the patient workflow.',
            badge: _subjectRelationship?.trim().isNotEmpty == true ? _subjectRelationship!.trim() : 'Medication',
          ),
          const SizedBox(height: 20),
          ProviderCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _InfoRow(label: 'Patient ID', value: _patientId.isEmpty ? '—' : _patientId),
                _InfoRow(label: 'Patient', value: _patientName.isEmpty ? '—' : _patientName),
                _InfoRow(label: 'Appointment ID', value: widget.appointmentId ?? '—'),
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
              children: <Widget>[
                TextField(controller: _drugController, decoration: const InputDecoration(labelText: 'Medication name')),
                const SizedBox(height: 16),
                TextField(controller: _dosageController, decoration: const InputDecoration(labelText: 'Dosage')),
                const SizedBox(height: 16),
                TextField(controller: _frequencyController, decoration: const InputDecoration(labelText: 'Frequency')),
                const SizedBox(height: 16),
                TextField(controller: _durationController, decoration: const InputDecoration(labelText: 'Duration')),
                const SizedBox(height: 16),
                TextField(controller: _pharmacyController, decoration: const InputDecoration(labelText: 'Preferred pharmacy (optional)')),
                const SizedBox(height: 16),
                TextField(controller: _noteController, maxLines: 4, decoration: const InputDecoration(labelText: 'Provider note')),
              ],
            ),
          ),
          const SizedBox(height: 16),
          DraftAttachmentEditor(
            attachments: _attachments,
            onChanged: (List<Map<String, dynamic>> value) => setState(() => _attachments = value),
            title: 'Attachment staging',
            subtitle: 'Stage prescription evidence or secure links locally while medication attachment endpoints are being completed.',
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _saving ? null : _previewCompliance,
                  icon: const Icon(Icons.rule_rounded),
                  label: const Text('Preview compliance'),
                ),
              ),
            ],
          ),
          if (_preview != null) ...<Widget>[
            const SizedBox(height: 16),
            ProviderCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(child: Text('Compliance preview', style: Theme.of(context).textTheme.titleMedium)),
                      StatusBadge(readBool(_preview, const <String>['requiresPolicyCheck']) ? 'Policy check required' : 'Preview ready'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Routing state: ${readString(_preview, const <String>['pharmacyRoutingState'], fallback: 'Manual review')}'),
                  const SizedBox(height: 8),
                  Text('Controlled medication: ${readBool(_preview, const <String>['controlledMedication']) ? 'Yes' : 'No'}'),
                  const SizedBox(height: 8),
                  Text('Refill eligible: ${readBool(_preview?['refillPolicy'], const <String>['refillEligible']) ? 'Yes' : 'No'} • Max count: ${readInt(_preview?['refillPolicy'], const <String>['refillMaxCount'])}'),
                  if (guidance.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 12),
                    for (final dynamic item in guidance)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Padding(
                              padding: EdgeInsets.only(top: 3),
                              child: Icon(Icons.info_outline_rounded, size: 18),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(item.toString())),
                          ],
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _saving ? null : () => _save(sign: false),
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('Save draft'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _saving ? null : () => _save(sign: true),
                  icon: const Icon(Icons.task_alt_rounded),
                  label: const Text('Sign & release'),
                ),
              ),
            ],
          ),
        ],
      ),
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
