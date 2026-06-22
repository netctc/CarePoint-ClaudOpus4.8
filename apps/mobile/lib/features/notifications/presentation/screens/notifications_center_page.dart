import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';

class NotificationsCenterPage extends StatefulWidget {
  const NotificationsCenterPage({super.key});

  @override
  State<NotificationsCenterPage> createState() => _NotificationsCenterPageState();
}

class _NotificationsCenterPageState extends State<NotificationsCenterPage> {
  late Future<_NotificationsData> _future;
  bool _showUnreadOnly = false;
  final Map<String, bool> _preferences = <String, bool>{
    'push': true,
    'sms': false,
    'email': true,
  };

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_NotificationsData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientNotificationSummary(),
      AppSession.instance.patientNotificationFeed(),
    ]);

    final Map<String, dynamic> summaryResponse = responses[0] as Map<String, dynamic>;
    final Map<String, dynamic> feedResponse = responses[1] as Map<String, dynamic>;
    return _NotificationsData(
      summary: (summaryResponse['summary'] as Map<String, dynamic>?) ?? <String, dynamic>{},
      items: (feedResponse['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList(),
    );
  }

  Future<void> _refresh() async {
    final Future<_NotificationsData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _markRead(String id) async {
    try {
      await AppSession.instance.markPatientNotificationRead(id);
      await _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _togglePreference(String channel, bool enabled) async {
    setState(() => _preferences[channel] = enabled);
    try {
      await AppSession.instance.updateNotificationPreference(channel: channel, enabled: enabled);
      await _refresh();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications Center'),
        centerTitle: true,
        actions: <Widget>[
          TextButton(
            onPressed: () => setState(() => _showUnreadOnly = !_showUnreadOnly),
            child: Text(_showUnreadOnly ? 'All' : 'Unread'),
          ),
        ],
      ),
      body: FutureBuilder<_NotificationsData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_NotificationsData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(error: snapshot.error.toString(), onRetry: _refresh);
          }

          final _NotificationsData data = snapshot.data!;
          final int unreadCount = (data.summary['unreadCount'] as num?)?.toInt() ?? data.items.where((Map<String, dynamic> item) => item['read'] != true).length;
          final int highPriorityCount = (data.summary['highPriorityCount'] as num?)?.toInt() ?? data.items.where((Map<String, dynamic> item) => '${item['priority']}'.toLowerCase() == 'high').length;
          final List<Map<String, dynamic>> visible = _showUnreadOnly
              ? data.items.where((Map<String, dynamic> item) => item['read'] != true).toList()
              : data.items;
          final List<Map<String, dynamic>> refillItems = visible.where((Map<String, dynamic> item) => item['prescriptionId'] != null || item['refillRequestId'] != null).toList();

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF7ED),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFFCD6A3)),
                  ),
                  child: Row(
                    children: <Widget>[
                      const Icon(Icons.notifications_active_outlined, color: AppColors.warning),
                      const SizedBox(width: 10),
                      Expanded(child: Text('$unreadCount unread · $highPriorityCount high priority. Pull to refresh for the latest updates.')),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text('Delivery preferences', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                  child: Column(
                    children: <Widget>[
                      _PreferenceTile(title: 'Push notifications', value: _preferences['push'] ?? true, onChanged: (bool value) => _togglePreference('push', value)),
                      const Divider(height: 24),
                      _PreferenceTile(title: 'SMS updates', value: _preferences['sms'] ?? false, onChanged: (bool value) => _togglePreference('sms', value)),
                      const Divider(height: 24),
                      _PreferenceTile(title: 'Email summaries', value: _preferences['email'] ?? true, onChanged: (bool value) => _togglePreference('email', value)),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (refillItems.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
                    child: Row(
                      children: <Widget>[
                        const Icon(Icons.medication_outlined, color: AppColors.primary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text('${refillItems.length} refill or prescription updates are ready. Tap a card below to open the linked prescription timeline.'),
                        ),
                      ],
                    ),
                  ),
                Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (visible.isEmpty)
                  const _NotificationEmptyState()
                else
                  ...visible.map((Map<String, dynamic> item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _NotificationTile(
                          item: item,
                          onTap: () async {
                            final String? route = _routeForItem(item);
                            if ((item['read'] != true) && (item['id'] != null)) {
                              await _markRead(item['id'].toString());
                            }
                            if (route != null && context.mounted) {
                              context.go(route);
                            }
                          },
                          onMarkRead: (item['read'] == true || item['id'] == null) ? null : () => _markRead(item['id'].toString()),
                        ),
                      )),
              ],
            ),
          );
        },
      ),
    );
  }
}

String? _routeForItem(Map<String, dynamic> item) {
  final String category = (item['category'] ?? '').toString().toLowerCase();
  if (category.contains('message') && item['threadId'] != null) {
    return '/messages/thread?id=${item['threadId']}';
  }
  if (category.contains('appointment') && item['appointmentId'] != null) {
    return '/appointments/detail?id=${item['appointmentId']}';
  }
  if (item['prescriptionId'] != null) {
    return '/prescriptions/detail?id=${item['prescriptionId']}';
  }
  if (category.contains('record') && item['documentId'] != null) {
    return '/records/document?id=${item['documentId']}';
  }
  if (category.contains('payment')) {
    return '/wallet/methods';
  }
  return null;
}

class _NotificationsData {
  const _NotificationsData({required this.summary, required this.items});

  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> items;
}

class _PreferenceTile extends StatelessWidget {
  const _PreferenceTile({required this.title, required this.value, required this.onChanged});

  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(child: Text(title)),
        Switch(value: value, onChanged: onChanged),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.item, this.onTap, this.onMarkRead});

  final Map<String, dynamic> item;
  final VoidCallback? onTap;
  final VoidCallback? onMarkRead;

  @override
  Widget build(BuildContext context) {
    final bool isRead = item['read'] == true;
    final bool isPinned = '${item['priority']}'.toLowerCase() == 'high';
    final String title = (item['title'] ?? 'Notification').toString();
    final String subtitle = (item['message'] ?? item['detail'] ?? '').toString();
    final String? agingBand = item['refillAgingBand']?.toString();
    final bool escalated = item['refillEscalated'] == true;
    final int timelineCount = (item['refillTimelineCount'] as num?)?.toInt() ?? 0;
    final int ownershipHistoryCount = (item['ownershipHistoryCount'] as num?)?.toInt() ?? 0;
    final int ownershipEscalationCount = (item['ownershipEscalationCount'] as num?)?.toInt() ?? 0;
    final String? latestOwnershipLabel = item['latestOwnershipLabel']?.toString();
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: isPinned ? const Color(0xFFFCD6A3) : AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: isPinned ? const Color(0xFFFFF7ED) : AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(isPinned ? Icons.priority_high_outlined : Icons.notifications_none, color: isPinned ? AppColors.warning : AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(subtitle.isEmpty ? 'Open for details.' : subtitle, style: Theme.of(context).textTheme.bodyMedium),
                    ],
                  ),
                ),
              ],
            ),
            if (latestOwnershipLabel != null && latestOwnershipLabel.isNotEmpty) ...<Widget>[
              const SizedBox(height: 10),
              Text('Latest ownership update: $latestOwnershipLabel', style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isRead ? AppColors.primarySoft : const Color(0xFFE0F2FE),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(isRead ? 'Read' : 'Unread', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primaryDark)),
                ),
                if (agingBand != null && agingBand.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(999)),
                    child: Text(agingBand.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.warning)),
                  ),
                if (timelineCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(999)),
                    child: Text('$timelineCount timeline updates', style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.primaryDark)),
                  ),
                if (ownershipHistoryCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(999)),
                    child: Text('$ownershipHistoryCount ownership updates', style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF5B21B6))),
                  ),
                if (ownershipEscalationCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(999)),
                    child: Text('$ownershipEscalationCount escalation${ownershipEscalationCount == 1 ? '' : 's'}', style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFFBE123C))),
                  ),
                if (escalated)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFFFDECEC), borderRadius: BorderRadius.circular(999)),
                    child: const Text('Escalated', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFFB42318))),
                  ),
                if (onMarkRead != null)
                  TextButton(onPressed: onMarkRead, child: const Text('Mark read')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationEmptyState extends StatelessWidget {
  const _NotificationEmptyState();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: AppColors.border)),
      child: const Text('You are all caught up.'),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});

  final String error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.notifications_off_outlined, size: 42, color: AppColors.warning),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
