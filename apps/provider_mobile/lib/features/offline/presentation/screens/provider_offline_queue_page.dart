import 'package:flutter/material.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderOfflineQueuePage extends StatefulWidget {
  const ProviderOfflineQueuePage({super.key});

  @override
  State<ProviderOfflineQueuePage> createState() => _ProviderOfflineQueuePageState();
}

class _ProviderOfflineQueuePageState extends State<ProviderOfflineQueuePage> {
  final OfflineActionQueue _queue = OfflineActionQueue.instance;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _queue,
      builder: (BuildContext context, _) {
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () => _queue.processAll(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Offline action queue',
                  subtitle: 'Retry queued clinical actions that were staged while connectivity was unavailable or unstable.',
                  badge: '${_queue.pendingCount} pending',
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: _queue.isProcessing ? null : () => _queue.processAll(),
                        icon: const Icon(Icons.sync_rounded),
                        label: Text(_queue.isProcessing ? 'Processing…' : 'Retry all'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _queue.items.any((Map<String, dynamic> item) => (item['status']?.toString() ?? '') == 'completed') ? () => _queue.clearCompleted() : null,
                        icon: const Icon(Icons.inventory_2_outlined),
                        label: const Text('Clear completed'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (_queue.items.isEmpty)
                  const EmptyStateCard(
                    title: 'No queued actions',
                    subtitle: 'When order, prescription, encounter, or refill mutations fail because of connectivity, they can be staged here for retry.',
                    icon: Icons.cloud_done_outlined,
                  )
                else
                  ..._queue.items.map((Map<String, dynamic> item) {
                    final String status = item['status']?.toString() ?? 'pending';
                    final List<dynamic> attachments = item['attachments'] is List ? item['attachments'] as List<dynamic> : const <dynamic>[];
                    final Color? tone = status == 'completed'
                        ? Colors.green.shade700
                        : status == 'failed'
                            ? Colors.orange.shade800
                            : null;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(child: Text(item['title']?.toString() ?? 'Queued action', style: Theme.of(context).textTheme.titleMedium)),
                                Text(status.toUpperCase(), style: TextStyle(fontWeight: FontWeight.w700, color: tone)),
                              ],
                            ),
                            const SizedBox(height: 8),
                            _InfoRow(label: 'Type', value: item['type']?.toString() ?? '—'),
                            _InfoRow(label: 'Patient', value: item['patientName']?.toString().trim().isNotEmpty == true ? item['patientName'].toString() : (item['patientId']?.toString() ?? '—')),
                            _InfoRow(label: 'Created', value: formatDateTimeLabel(item['createdAt']?.toString() ?? '')),
                            _InfoRow(label: 'Retries', value: item['retryCount']?.toString() ?? '0'),
                            if ((item['lastError']?.toString().trim() ?? '').isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(item['lastError'].toString(), style: TextStyle(color: Colors.orange.shade900)),
                              ),
                            if (attachments.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: Text('Staged attachments: ${attachments.length}'),
                              ),
                            const SizedBox(height: 12),
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: _queue.isProcessing || status == 'completed' ? null : () => _queue.retryOne(item['id']?.toString() ?? ''),
                                    icon: const Icon(Icons.refresh_rounded),
                                    label: const Text('Retry'),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => _queue.remove(item['id']?.toString() ?? ''),
                                    icon: const Icon(Icons.delete_outline_rounded),
                                    label: const Text('Remove'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
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
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 84, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}
