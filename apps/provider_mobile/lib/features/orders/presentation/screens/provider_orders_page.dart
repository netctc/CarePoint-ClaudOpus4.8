import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderOrdersPage extends StatefulWidget {
  const ProviderOrdersPage({super.key});

  @override
  State<ProviderOrdersPage> createState() => _ProviderOrdersPageState();
}

class _ProviderOrdersPageState extends State<ProviderOrdersPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.orderSummary(),
      'items': await api.orders(),
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
        final List<Map<String, dynamic>> items = pickList(snapshot.data?['items'], const <String>['items', 'orders']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Orders hub',
                  subtitle: 'Track active provider orders, open draft orders from patient charts, and continue submission workflows from mobile.',
                  badge: 'Clinical orders',
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
                    MetricCard(label: 'Active orders', value: '${readInt(summary, const <String>['activeOrders', 'openOrders', 'count'])}'),
                    MetricCard(label: 'Pending review', value: '${readInt(summary, const <String>['pendingReview', 'reviewCount'])}', variant: MetricVariant.warning),
                  ],
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No order items', subtitle: 'Provider order items will appear here when available.', icon: Icons.science_outlined)
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () {
                            final String id = readString(item, const <String>['id'], fallback: '');
                            if (id.isNotEmpty && id != '—') context.go('/orders/$id');
                          },
                          child: ProviderCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Row(
                                  children: <Widget>[
                                    Expanded(child: Text(readString(item, const <String>['patientName', 'title', 'orderName']), style: Theme.of(context).textTheme.titleMedium)),
                                    StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(readString(item, const <String>['reason', 'description'], fallback: 'Order item')),
                                const SizedBox(height: 12),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  children: <Widget>[
                                    Chip(label: Text(readString(item, const <String>['requestedBy'], fallback: 'Provider'))),
                                    if (readString(item, const <String>['updatedAt'], fallback: '').isNotEmpty)
                                      Chip(label: Text(formatDateLabel(readString(item, const <String>['updatedAt'], fallback: '')))),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: <Widget>[
                                    Expanded(
                                      child: OutlinedButton(
                                        onPressed: () {
                                          final String chartRoute = buildChartRoute(item);
                                          context.go(chartRoute);
                                        },
                                        child: const Text('Patient chart'),
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: FilledButton(
                                        onPressed: () {
                                          final String id = readString(item, const <String>['id'], fallback: '');
                                          if (id.isNotEmpty && id != '—') context.go('/orders/$id');
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
              ],
            ),
          ),
        );
      },
    );
  }
}
