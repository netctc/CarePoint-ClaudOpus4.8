import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderRecordsPage extends StatefulWidget {
  const ProviderRecordsPage({super.key});

  @override
  State<ProviderRecordsPage> createState() => _ProviderRecordsPageState();
}

class _ProviderRecordsPageState extends State<ProviderRecordsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.records();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.records());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final List<Map<String, dynamic>> items = pickList(snapshot.data, const <String>['items', 'records', 'encounters']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Clinical records hub',
                  subtitle: 'Patient record access, encounter data, and chart-related information from the shared records API.',
                  badge: 'Medical records',
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No records available', subtitle: 'Encounter and chart-related items will appear here when available.', icon: Icons.description_outlined)
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['patientName', 'subjectLabel', 'title']), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['recordType', 'type', 'status'], fallback: 'Record')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(item, const <String>['summary', 'type', 'title'], fallback: 'Clinical record')),
                              const SizedBox(height: 8),
                              Text(formatDateTimeLabel(readString(item, const <String>['createdAt', 'updatedAt', 'date'], fallback: ''))),
                              const SizedBox(height: 12),
                              Row(
                                children: <Widget>[
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () => context.go(buildChartRoute(item)),
                                      child: const Text('Open chart'),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: FilledButton(
                                      onPressed: () => context.go(buildRecordDetailRoute(item)),
                                      child: const Text('Open record'),
                                    ),
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
