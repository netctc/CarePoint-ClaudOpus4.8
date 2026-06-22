import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderRpmPage extends StatefulWidget {
  const ProviderRpmPage({super.key});

  @override
  State<ProviderRpmPage> createState() => _ProviderRpmPageState();
}

class _ProviderRpmPageState extends State<ProviderRpmPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.rpmSummary(),
      'patients': await api.rpmPatients(),
    };
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> summary = pickMap(snapshot.data?['summary'], const <String>['summary', 'overview']);
        final List<Map<String, dynamic>> patients = pickList(snapshot.data?['patients'], const <String>['patients', 'items']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Remote patient monitoring',
                  subtitle: 'Review RPM enrollment, alerting patients, and recent monitoring context from the provider RPM endpoints.',
                  badge: 'RPM',
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
                    MetricCard(label: 'Enrolled', value: '${readInt(summary, const <String>['enrolledCount', 'activeProgramCount'])}', variant: MetricVariant.success),
                    MetricCard(label: 'Alerting', value: '${readInt(summary, const <String>['alertingCount', 'patientsAlerting'])}', variant: MetricVariant.warning),
                  ],
                ),
                const SizedBox(height: 20),
                if (patients.isEmpty)
                  const EmptyStateCard(title: 'No RPM patients', subtitle: 'RPM patient lists will appear here when available.', icon: Icons.monitor_heart_outlined)
                else
                  ...patients.map((patient) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () {
                            final String id = readString(patient, const <String>['patientId', 'id'], fallback: '');
                            if (id.isNotEmpty && id != '—') {
                              context.go(buildRpmPatientRoute(id, patientName: readString(patient, const <String>['patientName'], fallback: 'Patient')));
                            }
                          },
                          child: ProviderCard(
                            child: Row(
                              children: <Widget>[
                                const CircleAvatar(child: Icon(Icons.monitor_heart_rounded)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(readString(patient, const <String>['patientName'], fallback: 'Patient'), style: Theme.of(context).textTheme.titleMedium),
                                      const SizedBox(height: 4),
                                      Text(readString(patient, const <String>['latestReading', 'device'], fallback: 'Reading unavailable')),
                                    ],
                                  ),
                                ),
                                StatusBadge(readString(patient, const <String>['thresholdStatus', 'status'], fallback: 'Tracked')),
                              ],
                            ),
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
