import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class PrescriptionsListPage extends StatefulWidget {
  const PrescriptionsListPage({super.key});

  @override
  State<PrescriptionsListPage> createState() => _PrescriptionsListPageState();
}

class _PrescriptionsListPageState extends State<PrescriptionsListPage> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.patientPrescriptions();
    final List<Map<String, dynamic>> items = (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    return items;
  }

  Future<void> _refresh() async {
    final Future<List<Map<String, dynamic>>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      currentIndex: 3,
      title: 'Prescriptions',
      subtitle: 'Medication status, refills, and pharmacy routing',
      showBack: true,
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load prescriptions', body: snapshot.error.toString(), icon: Icons.medication_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Try again'))),
            );
          }

          final List<Map<String, dynamic>> items = snapshot.data ?? <Map<String, dynamic>>[];
          final int active = items.where((Map<String, dynamic> item) => (item['status']?.toString() ?? '').toUpperCase() == 'ACTIVE').length;
          final int refillEligible = items.where((Map<String, dynamic> item) => item['refillEligible'] == true).length;

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: '${items.length} medications',
                  title: 'Stay on track with every prescription',
                  subtitle: 'Review active medications, refill history, and pharmacy progress in one place.',
                ),
                const SizedBox(height: 18),
                if (!AppSession.instance.isSelfSubject) ...<Widget>[
                  PatientActiveProfileCard(label: AppSession.instance.activeSubjectLabel, relationship: AppSession.instance.activeSubjectRelationship),
                  const SizedBox(height: 18),
                ],
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Active', value: '$active', caption: 'Current medication plans', icon: Icons.medication_liquid_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Refill ready', value: '$refillEligible', caption: 'Eligible for request', icon: Icons.refresh_outlined)),
                  ],
                ),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Medication list'),
                const SizedBox(height: 12),
                if (items.isEmpty)
                  const PatientEmptyState(title: 'No prescriptions yet', body: 'Prescriptions released by your care team will appear here.', icon: Icons.medication_outlined)
                else
                  ...items.map((Map<String, dynamic> item) {
                    final List<Map<String, dynamic>> refillRequests = (item['refillRequests'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
                    final Map<String, dynamic>? latestRefill = refillRequests.isNotEmpty ? refillRequests.first : null;
                    final String title = item['title']?.toString() ?? 'Prescription';
                    final String subtitle = [item['dosage']?.toString() ?? '', item['frequency']?.toString() ?? '', item['duration']?.toString() ?? ''].where((String text) => text.isNotEmpty).join(' • ');
                    final String routeState = item['pharmacyRoutingState']?.toString().replaceAll('_', ' ') ?? 'Routing pending';
                    final String detailId = item['prescriptionId']?.toString() ?? item['id']?.toString() ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PatientCard(
                        child: InkWell(
                          onTap: detailId.isEmpty ? null : () => context.go('/prescriptions/detail?id=$detailId'),
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                                  PatientStatusBadge(label: item['status']?.toString() ?? 'ACTIVE'),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(subtitle.isEmpty ? 'Take as directed' : subtitle, style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: <Widget>[
                                  PatientTag(label: item['fulfillmentStatus']?.toString().replaceAll('_', ' ') ?? 'Awaiting review', icon: Icons.local_pharmacy_outlined),
                                  PatientTag(label: routeState, icon: Icons.route_outlined),
                                  if (latestRefill != null) PatientTag(label: latestRefill['status']?.toString().replaceAll('_', ' ') ?? 'Request logged', icon: Icons.history_toggle_off_outlined),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(item['note']?.toString() ?? 'View refill timeline, governance notes, and clinical instructions.', style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      ),
    );
  }
}
