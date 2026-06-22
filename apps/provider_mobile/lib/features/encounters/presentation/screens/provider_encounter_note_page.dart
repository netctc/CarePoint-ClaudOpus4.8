import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/draft_attachment_editor.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderEncounterNotePage extends StatefulWidget {
  const ProviderEncounterNotePage({
    required this.patientId,
    this.appointmentId,
    this.patientName,
    this.subjectProfileId,
    this.subjectLabel,
    this.subjectRelationship,
    super.key,
  });

  final String patientId;
  final String? appointmentId;
  final String? patientName;
  final String? subjectProfileId;
  final String? subjectLabel;
  final String? subjectRelationship;

  @override
  State<ProviderEncounterNotePage> createState() => _ProviderEncounterNotePageState();
}

class _ProviderEncounterNotePageState extends State<ProviderEncounterNotePage> {
  final TextEditingController _subjectiveController = TextEditingController();
  final TextEditingController _objectiveController = TextEditingController();
  final TextEditingController _assessmentController = TextEditingController();
  final TextEditingController _planController = TextEditingController();
  final TextEditingController _diagnosisCodeController = TextEditingController();

  bool _signatureAttested = false;
  bool _submitting = false;
  Map<String, dynamic>? _validation;
  List<Map<String, dynamic>> _attachments = <Map<String, dynamic>>[];

  @override
  void dispose() {
    _subjectiveController.dispose();
    _objectiveController.dispose();
    _assessmentController.dispose();
    _planController.dispose();
    _diagnosisCodeController.dispose();
    super.dispose();
  }

  Map<String, dynamic> _payload() {
    return <String, dynamic>{
      'patientId': widget.patientId,
      'appointmentId': widget.appointmentId,
      'subjective': _subjectiveController.text.trim(),
      'objective': _objectiveController.text.trim(),
      'assessment': _assessmentController.text.trim(),
      'plan': _planController.text.trim(),
      'diagnosisCode': _diagnosisCodeController.text.trim(),
      'signatureAttested': _signatureAttested,
      if (_attachments.isNotEmpty) 'attachments': _attachments,
    };
  }

  Future<void> _validate() async {
    setState(() => _submitting = true);
    try {
      final Map<String, dynamic> response = await ProviderSession.instance.api.validateEncounterNote(_payload());
      setState(() => _validation = pickMap(response, const <String>['validation', 'item', 'data']));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Encounter note validation completed.')));
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _sign() async {
    final Map<String, dynamic> payload = _payload();
    setState(() => _submitting = true);
    try {
      final Map<String, dynamic> response = await ProviderSession.instance.api.signEncounterNote(payload);
      setState(() => _validation = pickMap(response, const <String>['validation', 'item', 'data']));
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Encounter note signed successfully.')));
      context.go(
        buildAppRoute(
          '/chart/${widget.patientId}',
          queryParameters: <String, String?>{
            'patientName': widget.patientName,
            'subjectProfileId': widget.subjectProfileId,
            'subjectLabel': widget.subjectLabel,
            'subjectRelationship': widget.subjectRelationship,
          },
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(
          type: 'encounter_sign',
          title: 'Encounter note for ${widget.subjectLabel ?? widget.patientName ?? widget.patientId}',
          payload: payload,
          patientId: widget.patientId,
          patientName: widget.subjectLabel ?? widget.patientName,
          attachments: _attachments,
        );
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connection issue detected. The encounter note was added to the offline queue.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<dynamic> warningValues = _validation?['warnings'] is List ? (_validation!['warnings'] as List<dynamic>) : const <dynamic>[];
    final List<dynamic> issueValues = _validation?['issues'] is List ? (_validation!['issues'] as List<dynamic>) : const <dynamic>[];
    final bool ready = readBool(_validation, const <String>['ready']);

    return SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: <Widget>[
          ProviderHeroCard(
            title: widget.subjectLabel?.trim().isNotEmpty == true ? widget.subjectLabel!.trim() : (widget.patientName?.trim().isNotEmpty == true ? widget.patientName!.trim() : 'Encounter note'),
            subtitle: 'Complete subjective, objective, assessment, and plan sections, then validate readiness before signing.',
            badge: widget.subjectRelationship?.trim().isNotEmpty == true ? widget.subjectRelationship!.trim() : 'SOAP note',
          ),
          const SizedBox(height: 20),
          ProviderCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Clinical context', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                _ContextRow(label: 'Patient ID', value: widget.patientId),
                _ContextRow(label: 'Appointment ID', value: widget.appointmentId ?? '—'),
                _ContextRow(label: 'Patient', value: widget.patientName ?? widget.subjectLabel ?? '—'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ProviderCard(
            child: Column(
              children: <Widget>[
                _NoteField(label: 'Subjective', controller: _subjectiveController, hintText: 'Symptoms, history, patient concerns, medication adherence…'),
                const SizedBox(height: 16),
                _NoteField(label: 'Objective', controller: _objectiveController, hintText: 'Exam findings, vitals, observations, labs…'),
                const SizedBox(height: 16),
                _NoteField(label: 'Assessment', controller: _assessmentController, hintText: 'Clinical impression, diagnosis summary, differential…'),
                const SizedBox(height: 16),
                _NoteField(label: 'Plan', controller: _planController, hintText: 'Treatment plan, monitoring, follow-up, referrals…'),
                const SizedBox(height: 16),
                _NoteField(label: 'Diagnosis code', controller: _diagnosisCodeController, maxLines: 1, hintText: 'Example: I10'),
                const SizedBox(height: 16),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _signatureAttested,
                  title: const Text('I attest this note is complete and ready for signing.'),
                  onChanged: (value) => setState(() => _signatureAttested = value ?? false),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          DraftAttachmentEditor(
            attachments: _attachments,
            onChanged: (List<Map<String, dynamic>> value) => setState(() => _attachments = value),
            title: 'Evidence staging',
            subtitle: 'Stage attachment metadata locally while dedicated provider attachment upload endpoints are still being finalized.',
          ),
          const SizedBox(height: 16),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _submitting ? null : _validate,
                  icon: const Icon(Icons.rule_folder_rounded),
                  label: const Text('Validate'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _sign,
                  icon: const Icon(Icons.task_alt_rounded),
                  label: const Text('Sign note'),
                ),
              ),
            ],
          ),
          if (_validation != null) ...<Widget>[
            const SizedBox(height: 16),
            ProviderCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(child: Text('Validation result', style: Theme.of(context).textTheme.titleMedium)),
                      StatusBadge(ready ? 'Ready to sign' : 'Needs attention'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Recommended title: ${readString(_validation, const <String>['recommendedTitle'], fallback: 'Encounter note')}'),
                  const SizedBox(height: 8),
                  Text('Sections completed: ${readInt(_validation, const <String>['sectionsCompleted'])}'),
                  if (issueValues.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    Text('Issues', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    for (final dynamic item in issueValues)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Padding(
                              padding: EdgeInsets.only(top: 3),
                              child: Icon(Icons.error_outline_rounded, size: 18),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(item.toString())),
                          ],
                        ),
                      ),
                  ],
                  if (warningValues.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 16),
                    Text('Warnings', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 8),
                    for (final dynamic item in warningValues)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Padding(
                              padding: EdgeInsets.only(top: 3),
                              child: Icon(Icons.warning_amber_rounded, size: 18),
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
        ],
      ),
    );
  }
}

class _ContextRow extends StatelessWidget {
  const _ContextRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
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

class _NoteField extends StatelessWidget {
  const _NoteField({
    required this.label,
    required this.controller,
    this.hintText,
    this.maxLines = 5,
  });

  final String label;
  final TextEditingController controller;
  final String? hintText;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(hintText: hintText),
        ),
      ],
    );
  }
}
