import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderOrderDetailPage extends StatefulWidget {
  const ProviderOrderDetailPage({required this.orderId, super.key});

  final String orderId;

  @override
  State<ProviderOrderDetailPage> createState() => _ProviderOrderDetailPageState();
}

class _ProviderOrderDetailPageState extends State<ProviderOrderDetailPage> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.orderDetail(widget.orderId);
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.orderDetail(widget.orderId));

  Future<void> _submit(Map<String, dynamic> item) async {
    setState(() => _submitting = true);
    try {
      await ProviderSession.instance.api.submitOrder(widget.orderId, note: readString(item, const <String>['note'], fallback: ''));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Clinical order submitted.')));
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
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'order', 'data']);
        final List<Map<String, dynamic>> groups = pickList(item, const <String>['orderGroups', 'items']);
        final List<dynamic> selections = item['commonSelections'] is List ? item['commonSelections'] as List<dynamic> : const <dynamic>[];
        final String chartRoute = buildChartRoute(item);
        final bool canSubmit = readString(item, const <String>['status'], fallback: 'DRAFT').toUpperCase() == 'DRAFT';

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['title', 'patientName'], fallback: 'Clinical order'),
                  subtitle: readString(item, const <String>['reason'], fallback: 'Order detail'),
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
                        onPressed: !_submitting && canSubmit ? () => _submit(item) : null,
                        icon: const Icon(Icons.send_rounded),
                        label: const Text('Submit'),
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
                      _InfoRow(label: 'Encounter ID', value: readString(item, const <String>['encounterId', 'appointmentId'], fallback: '—')),
                      _InfoRow(label: 'Requested by', value: readString(item, const <String>['requestedBy'], fallback: '—')),
                      _InfoRow(label: 'Updated', value: formatDateTimeLabel(readString(item, const <String>['updatedAt'], fallback: ''))),
                      _InfoRow(label: 'Note', value: readString(item, const <String>['note'], fallback: '—')),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Requested items'),
                const SizedBox(height: 12),
                if (groups.isEmpty && selections.isEmpty)
                  const EmptyStateCard(
                    title: 'No requested items captured',
                    subtitle: 'Selections and grouped requests will appear here once the order is drafted.',
                    icon: Icons.science_outlined,
                  )
                else ...<Widget>[
                  for (final Map<String, dynamic> group in groups)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(child: Text(readString(group, const <String>['title'], fallback: 'Requested item'), style: Theme.of(context).textTheme.titleMedium)),
                                StatusBadge(readString(group, const <String>['status'], fallback: 'Requested')),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(readString(group, const <String>['description'], fallback: 'No description provided.')),
                          ],
                        ),
                      ),
                    ),
                  if (selections.isNotEmpty)
                    ProviderCard(
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: selections.map((dynamic value) => Chip(label: Text(value.toString()))).toList(),
                      ),
                    ),
                ],
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
