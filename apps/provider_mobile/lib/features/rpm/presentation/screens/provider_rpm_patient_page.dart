import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderRpmPatientPage extends StatefulWidget {
  const ProviderRpmPatientPage({required this.patientId, this.patientName, super.key});

  final String patientId;
  final String? patientName;

  @override
  State<ProviderRpmPatientPage> createState() => _ProviderRpmPatientPageState();
}

class _ProviderRpmPatientPageState extends State<ProviderRpmPatientPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.rpmPatient(widget.patientId);
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.rpmPatient(widget.patientId));

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'patient', 'data']);
        final List<Map<String, dynamic>> thresholds = pickList(item, const <String>['thresholds', 'items']);
        final List<Map<String, dynamic>> readings = pickList(item, const <String>['readings']);
        final List<Map<String, dynamic>> outreachLog = pickList(item, const <String>['outreachLog', 'timeline']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['patientName'], fallback: widget.patientName ?? 'RPM patient'),
                  subtitle: readString(item, const <String>['device'], fallback: 'Remote patient monitoring enrollment'),
                  badge: readString(item, const <String>['programStatus', 'status'], fallback: 'Active'),
                  trailing: OutlinedButton.icon(
                    onPressed: () => context.go(buildAppRoute('/chart/${widget.patientId}', queryParameters: <String, String?>{'patientName': readString(item, const <String>['patientName'], fallback: widget.patientName ?? 'Patient')})),
                    icon: const Icon(Icons.folder_shared_rounded),
                    label: const Text('Patient chart'),
                  ),
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Thresholds'),
                const SizedBox(height: 12),
                if (thresholds.isEmpty)
                  const EmptyStateCard(title: 'No thresholds configured', subtitle: 'Configured RPM thresholds will appear here.', icon: Icons.monitor_heart_outlined)
                else
                  ...thresholds.map((threshold) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              Expanded(child: Text(readString(threshold, const <String>['label'], fallback: 'Threshold'), style: Theme.of(context).textTheme.titleMedium)),
                              const SizedBox(width: 12),
                              Text(readString(threshold, const <String>['value'], fallback: '—')),
                              const SizedBox(width: 12),
                              StatusBadge(readString(threshold, const <String>['status'], fallback: 'Configured')),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Recent readings'),
                const SizedBox(height: 12),
                if (readings.isEmpty)
                  const EmptyStateCard(title: 'No RPM readings yet', subtitle: 'Recent device readings will appear here.', icon: Icons.query_stats_outlined)
                else
                  ...readings.map((reading) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(reading, const <String>['metric'], fallback: 'Reading'), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 6),
                                    Text(readString(reading, const <String>['value'], fallback: '—')),
                                    const SizedBox(height: 6),
                                    Text(formatDateTimeLabel(readString(reading, const <String>['time'], fallback: ''))),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(reading, const <String>['status'], fallback: 'Tracked')),
                            ],
                          ),
                        ),
                      )),
                if (outreachLog.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 8),
                  const SectionTitle(title: 'Outreach log'),
                  const SizedBox(height: 12),
                  ...outreachLog.map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(readString(entry, const <String>['by'], fallback: 'Care team'), style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 6),
                              Text(formatDateTimeLabel(readString(entry, const <String>['time'], fallback: ''))),
                              const SizedBox(height: 8),
                              Text(readString(entry, const <String>['note'], fallback: '')),
                            ],
                          ),
                        ),
                      )),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
