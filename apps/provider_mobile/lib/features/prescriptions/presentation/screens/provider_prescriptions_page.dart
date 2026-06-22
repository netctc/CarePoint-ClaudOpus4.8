import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderPrescriptionsPage extends StatefulWidget {
  const ProviderPrescriptionsPage({super.key});

  @override
  State<ProviderPrescriptionsPage> createState() => _ProviderPrescriptionsPageState();
}

class _ProviderPrescriptionsPageState extends State<ProviderPrescriptionsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.prescriptionSummary(),
      'items': await api.prescriptions(),
      'refills': await api.refillRequests(),
    };
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _reviewRefill(String id, String action) async {
    try {
      await ProviderSession.instance.api.reviewRefillRequest(id, <String, dynamic>{
        'action': action,
        'note': action == 'APPROVE' ? 'Approved from provider mobile.' : action == 'ROUTE_TO_PHARMACY' ? 'Routed from provider mobile.' : 'Updated from provider mobile.',
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Refill request ${action.toLowerCase().replaceAll('_', ' ')}.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> summary = pickMap(snapshot.data?['summary'], const <String>['summary', 'overview']);
        final List<Map<String, dynamic>> items = pickList(snapshot.data?['items'], const <String>['items', 'prescriptions']);
        final List<Map<String, dynamic>> refills = pickList(snapshot.data?['refills'], const <String>['items', 'requests', 'refillRequests']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Prescriptions',
                  subtitle: 'Prescription operations, refill requests, and medication workflows adapted for provider mobile use.',
                  badge: 'Medication management',
                  trailing: FilledButton.icon(
                    onPressed: () => context.go('/queue'),
                    icon: const Icon(Icons.event_note_rounded),
                    label: const Text('Open from queue'),
                  ),
                ),
                const SizedBox(height: 20),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
                  children: <Widget>[
                    MetricCard(label: 'Active prescriptions', value: '${readInt(summary, const <String>['activePrescriptions', 'count'])}'),
                    MetricCard(label: 'Refill requests', value: '${refills.length}', variant: MetricVariant.warning),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Prescription items'),
                const SizedBox(height: 12),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No prescriptions found', subtitle: 'Prescription items will appear here when available.', icon: Icons.medication_outlined)
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () {
                            final String id = readString(item, const <String>['id'], fallback: '');
                            if (id.isNotEmpty && id != '—') context.go('/prescriptions/$id');
                          },
                          child: ProviderCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Row(
                                  children: <Widget>[
                                    Expanded(child: Text(readString(item, const <String>['patientName', 'drug', 'title']), style: Theme.of(context).textTheme.titleMedium)),
                                    StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(readString(item, const <String>['drug', 'dosage', 'description'], fallback: 'Medication item')),
                                const SizedBox(height: 12),
                                Row(
                                  children: <Widget>[
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () => context.go(buildChartRoute(item)),
                                        child: const Text('Patient chart'),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: FilledButton(
                                        onPressed: () {
                                          final String id = readString(item, const <String>['id'], fallback: '');
                                          if (id.isNotEmpty && id != '—') context.go('/prescriptions/$id');
                                        },
                                        child: const Text('Open detail'),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Refill requests'),
                const SizedBox(height: 12),
                if (refills.isEmpty)
                  const EmptyStateCard(title: 'No refill requests', subtitle: 'Refill queue items will appear here.', icon: Icons.repeat_rounded)
                else
                  ...refills.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['patientName', 'drug', 'title'], fallback: 'Refill request'), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Open')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('Prescription ${readString(item, const <String>['prescriptionId'], fallback: '—')} • ${readString(item, const <String>['pharmacyRoutingState', 'queue'], fallback: 'Manual review')}'),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: <Widget>[
                                  OutlinedButton(onPressed: () => _reviewRefill(readString(item, const <String>['id'], fallback: ''), 'APPROVE'), child: const Text('Approve')),
                                  OutlinedButton(onPressed: () => _reviewRefill(readString(item, const <String>['id'], fallback: ''), 'ROUTE_TO_PHARMACY'), child: const Text('Route')),
                                  OutlinedButton(onPressed: () => _reviewRefill(readString(item, const <String>['id'], fallback: ''), 'REJECT'), child: const Text('Reject')),
                                  FilledButton(
                                    onPressed: () {
                                      final String id = readString(item, const <String>['id'], fallback: '');
                                      if (id.isNotEmpty && id != '—') context.go('/prescriptions/refills/$id');
                                    },
                                    child: const Text('Open detail'),
                                  ),
                                ],
                              ),
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
