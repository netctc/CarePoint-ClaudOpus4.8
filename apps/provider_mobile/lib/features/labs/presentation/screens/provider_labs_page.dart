import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderLabsPage extends StatefulWidget {
  const ProviderLabsPage({super.key});

  @override
  State<ProviderLabsPage> createState() => _ProviderLabsPageState();
}

class _ProviderLabsPageState extends State<ProviderLabsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.labsSummary(),
      'inbox': await api.labsInbox(),
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
        final List<Map<String, dynamic>> items = pickList(snapshot.data?['inbox'], const <String>['items', 'results', 'inbox']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Labs inbox',
                  subtitle: 'Pending and reviewed lab items available from the provider labs APIs with mobile-friendly result inspection.',
                  badge: 'Laboratory',
                ),
                const SizedBox(height: 20),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 2.2,
                  children: <Widget>[
                    MetricCard(label: 'Pending items', value: '${readInt(summary, const <String>['pendingCount', 'pending'])}', variant: MetricVariant.warning),
                    MetricCard(label: 'Released results', value: '${readInt(summary, const <String>['releasedCount', 'released'])}', variant: MetricVariant.success),
                  ],
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No lab items', subtitle: 'Lab inbox items will appear here when available.', icon: Icons.biotech_outlined)
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () {
                            final String id = readString(item, const <String>['id'], fallback: '');
                            if (id.isNotEmpty && id != '—') context.go('/labs/$id');
                          },
                          child: ProviderCard(
                            child: Row(
                              children: <Widget>[
                                const CircleAvatar(child: Icon(Icons.biotech_rounded)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(readString(item, const <String>['testName', 'title'], fallback: 'Lab item'), style: Theme.of(context).textTheme.titleMedium),
                                      const SizedBox(height: 4),
                                      Text(readString(item, const <String>['patientName'], fallback: 'Patient')),
                                    ],
                                  ),
                                ),
                                StatusBadge(readString(item, const <String>['status'], fallback: 'Pending')),
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
