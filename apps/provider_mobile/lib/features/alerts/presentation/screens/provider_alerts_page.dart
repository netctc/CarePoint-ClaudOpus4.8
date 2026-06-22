import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderAlertsPage extends StatefulWidget {
  const ProviderAlertsPage({super.key});

  @override
  State<ProviderAlertsPage> createState() => _ProviderAlertsPageState();
}

class _ProviderAlertsPageState extends State<ProviderAlertsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.alerts();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.alerts());
  }

  Future<void> _acknowledge(String id) async {
    await ProviderSession.instance.api.acknowledgeAlert(id);
    _refresh();
  }

  Future<void> _resolve(String id) async {
    await ProviderSession.instance.api.resolveAlert(id);
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final List<Map<String, dynamic>> items = pickList(snapshot.data, const <String>['alerts', 'items']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Provider alerts',
                  subtitle: 'Mobile follow-up for clinical, RPM, messaging, and operational alerts requiring provider attention.',
                  badge: 'Attention needed',
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No open alerts', subtitle: 'Open alerts will appear here when attention is required.', icon: Icons.task_alt_rounded)
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['title', 'name']), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['severity', 'status'], fallback: 'Open')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(item, const <String>['detail', 'description', 'summary'], fallback: 'Alert detail unavailable')),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 12,
                                runSpacing: 12,
                                children: <Widget>[
                                  OutlinedButton.icon(
                                    onPressed: () {
                                      final String id = readString(item, const <String>['id'], fallback: '');
                                      if (id.isNotEmpty && id != '—') _acknowledge(id);
                                    },
                                    icon: const Icon(Icons.visibility_outlined),
                                    label: const Text('Acknowledge'),
                                  ),
                                  FilledButton.icon(
                                    onPressed: () {
                                      final String id = readString(item, const <String>['id'], fallback: '');
                                      if (id.isNotEmpty && id != '—') _resolve(id);
                                    },
                                    icon: const Icon(Icons.task_alt_rounded),
                                    label: const Text('Resolve'),
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
