import 'package:flutter/material.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class PrescriptionDetailPage extends StatefulWidget {
  const PrescriptionDetailPage({super.key, this.prescriptionId});

  final String? prescriptionId;

  @override
  State<PrescriptionDetailPage> createState() => _PrescriptionDetailPageState();
}

class _PrescriptionDetailPageState extends State<PrescriptionDetailPage> {
  late Future<Map<String, dynamic>> _future;
  bool _requesting = false;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final String id = widget.prescriptionId ?? '';
    if (id.isEmpty) {
      throw Exception('Missing prescription identifier');
    }
    final Map<String, dynamic> response = await AppSession.instance.patientPrescriptionDetail(id);
    return (response['item'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<void> _refresh() async {
    final Future<Map<String, dynamic>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _requestRefill(String prescriptionId) async {
    setState(() {
      _requesting = true;
      _message = null;
      _error = null;
    });
    try {
      final Map<String, dynamic> response = await AppSession.instance.requestPrescriptionRefill(prescriptionId, note: 'Requested from patient mobile app');
      final Map<String, dynamic> item = (response['item'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      setState(() {
        _message = 'Refill request sent. Routing state: ${(item['pharmacyRoutingState'] ?? 'MANUAL_REVIEW').toString().replaceAll('_', ' ')}.';
      });
      await _refresh();
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _requesting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Prescription detail',
      subtitle: 'Medication instructions, refill workflow, and release notes',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load prescription', body: snapshot.error.toString(), icon: Icons.medication_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Try again'))),
            );
          }
          final Map<String, dynamic> item = snapshot.data ?? <String, dynamic>{};
          final List<Map<String, dynamic>> refillRequests = (item['refillRequests'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final List<Map<String, dynamic>> timeline = (item['refillTimeline'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final List<dynamic> governanceNotes = item['governanceNotes'] as List<dynamic>? ?? <dynamic>[];
          final bool refillEligible = item['refillEligible'] == true;
          final String prescriptionId = item['prescriptionId']?.toString() ?? item['id']?.toString() ?? widget.prescriptionId ?? '';

          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: item['status']?.toString() ?? 'ACTIVE',
                title: item['title']?.toString() ?? 'Prescription',
                subtitle: [item['dosage']?.toString() ?? '', item['frequency']?.toString() ?? '', item['duration']?.toString() ?? ''].where((String value) => value.isNotEmpty).join(' • '),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    PatientTag(label: item['fulfillmentStatus']?.toString().replaceAll('_', ' ') ?? 'Awaiting review', icon: Icons.local_pharmacy_outlined),
                    PatientTag(label: item['pharmacyRoutingState']?.toString().replaceAll('_', ' ') ?? 'Provider review', icon: Icons.route_outlined),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if ((_message ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: PatientTintedCard(
                    tint: const Color(0xFFDCFCE7),
                    child: Text(_message!, style: Theme.of(context).textTheme.bodyMedium),
                  ),
                ),
              if ((_error ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: PatientTintedCard(
                    tint: const Color(0xFFFEE2E2),
                    child: Text(_error!, style: Theme.of(context).textTheme.bodyMedium),
                  ),
                ),
              Row(
                children: <Widget>[
                  Expanded(child: PatientMetricCard(label: 'Refill requests', value: '${refillRequests.length}', caption: refillEligible ? 'Eligible for new request' : 'Refill review pending', icon: Icons.refresh_rounded)),
                  const SizedBox(width: 12),
                  Expanded(child: PatientMetricCard(label: 'Governance notes', value: '${governanceNotes.length}', caption: 'Clinical and policy guidance', icon: Icons.gavel_outlined)),
                ],
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Medication overview'),
              const SizedBox(height: 12),
              PatientCard(
                child: Column(
                  children: <Widget>[
                    PatientInfoRow(label: 'Medication', value: item['title']?.toString() ?? 'Prescription', icon: Icons.medication_outlined),
                    PatientInfoRow(label: 'Dosage', value: item['dosage']?.toString() ?? 'Take as directed', icon: Icons.straighten_outlined),
                    PatientInfoRow(label: 'Frequency', value: item['frequency']?.toString() ?? 'See instructions', icon: Icons.repeat_outlined),
                    PatientInfoRow(label: 'Dispense', value: item['dispenseQuantity']?.toString() ?? 'See pharmacy', icon: Icons.inventory_2_outlined),
                    PatientInfoRow(label: 'Instructions', value: item['instructions']?.toString() ?? item['note']?.toString() ?? 'No additional instructions', icon: Icons.description_outlined),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Refill timeline'),
              const SizedBox(height: 12),
              PatientCard(
                child: timeline.isEmpty
                    ? const Text('No refill timeline events yet. Use the action below to request support or a refill.')
                    : Column(
                        children: List<Widget>.generate(timeline.length, (int index) {
                          final Map<String, dynamic> entry = timeline[index];
                          return PatientTimelineStep(
                            title: entry['label']?.toString() ?? entry['status']?.toString().replaceAll('_', ' ') ?? 'Update',
                            subtitle: entry['timestamp']?.toString() ?? entry['note']?.toString() ?? 'Prescription timeline event',
                            isLast: index == timeline.length - 1,
                          );
                        }),
                      ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Release and safety notes'),
              const SizedBox(height: 12),
              PatientCard(
                child: governanceNotes.isEmpty
                    ? const Text('No additional governance notes were released with this prescription.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: governanceNotes.map((dynamic note) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text('• ${note.toString()}'),
                        )).toList(),
                      ),
              ),
            ],
          );
        },
      ),
      bottomAction: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: FilledButton.icon(
          onPressed: !_requesting && (widget.prescriptionId ?? '').isNotEmpty ? () => _requestRefill(widget.prescriptionId!) : null,
          icon: const Icon(Icons.refresh_outlined),
          label: Text(_requesting ? 'Submitting request…' : 'Request refill'),
        ),
      ),
    );
  }
}
