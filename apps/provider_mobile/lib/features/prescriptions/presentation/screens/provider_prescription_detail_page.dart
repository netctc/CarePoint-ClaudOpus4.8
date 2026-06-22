import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderPrescriptionDetailPage extends StatefulWidget {
  const ProviderPrescriptionDetailPage({required this.prescriptionId, super.key});

  final String prescriptionId;

  @override
  State<ProviderPrescriptionDetailPage> createState() => _ProviderPrescriptionDetailPageState();
}

class _ProviderPrescriptionDetailPageState extends State<ProviderPrescriptionDetailPage> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.prescriptionDetail(widget.prescriptionId);
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.prescriptionDetail(widget.prescriptionId));

  Future<void> _sign(Map<String, dynamic> item) async {
    setState(() => _submitting = true);
    try {
      await ProviderSession.instance.api.signPrescription(widget.prescriptionId, note: readString(item, const <String>['note'], fallback: ''));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Prescription signed and released.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'prescription', 'data']);
        final List<Map<String, dynamic>> checks = pickList(item, const <String>['complianceChecks', 'checks']);
        final bool canSign = readString(item, const <String>['status'], fallback: 'DRAFT').toUpperCase() == 'DRAFT';
        final String chartRoute = buildChartRoute(item);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['title', 'drug'], fallback: 'Prescription detail'),
                  subtitle: readString(item, const <String>['patientName'], fallback: 'Medication workflow'),
                  badge: readString(item, const <String>['status'], fallback: 'Draft'),
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      OutlinedButton.icon(
                        onPressed: () => context.go(chartRoute),
                        icon: const Icon(Icons.folder_shared_rounded),
                        label: const Text('Back to chart'),
                      ),
                      FilledButton.icon(
                        onPressed: !_submitting && canSign ? () => _sign(item) : null,
                        icon: const Icon(Icons.task_alt_rounded),
                        label: const Text('Sign'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Patient', value: readString(item, const <String>['patientName'], fallback: '—')),
                      _InfoRow(label: 'Drug', value: readString(item, const <String>['drug'], fallback: '—')),
                      _InfoRow(label: 'Dosage', value: readString(item, const <String>['dosage'], fallback: '—')),
                      _InfoRow(label: 'Frequency', value: readString(item, const <String>['frequency'], fallback: '—')),
                      _InfoRow(label: 'Duration', value: readString(item, const <String>['duration'], fallback: '—')),
                      _InfoRow(label: 'Pharmacy', value: readString(item, const <String>['pharmacyName'], fallback: 'Manual review')),
                      _InfoRow(label: 'Note', value: readString(item, const <String>['note'], fallback: '—')),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Compliance checks'),
                const SizedBox(height: 12),
                if (checks.isEmpty)
                  const EmptyStateCard(
                    title: 'No compliance checks captured',
                    subtitle: 'Medication safety and routing checks will appear here.',
                    icon: Icons.rule_rounded,
                  )
                else
                  ...checks.map((check) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(check, const <String>['label'], fallback: 'Compliance check'), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(check, const <String>['status'], fallback: 'Review')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(check, const <String>['detail'], fallback: '')),
                            ],
                          ),
                        ),
                      )),
              ],
            ),
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
