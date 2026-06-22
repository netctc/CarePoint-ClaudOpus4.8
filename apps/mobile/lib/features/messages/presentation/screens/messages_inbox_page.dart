import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class MessagesInboxPage extends StatefulWidget {
  const MessagesInboxPage({super.key});

  @override
  State<MessagesInboxPage> createState() => _MessagesInboxPageState();
}

class _MessagesInboxPageState extends State<MessagesInboxPage> {
  late Future<List<Map<String, dynamic>>> _future;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.threads();
    final List<Map<String, dynamic>> items = (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    items.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final DateTime aDate = _parseDate((a['latestMessage'] as Map<String, dynamic>?)?['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final DateTime bDate = _parseDate((b['latestMessage'] as Map<String, dynamic>?)?['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
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
      currentIndex: 2,
      title: 'Messages',
      subtitle: 'Secure conversations with your care team.',
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: PatientEmptyState(
                  title: 'Could not load inbox',
                  body: snapshot.error.toString(),
                  icon: Icons.cloud_off_outlined,
                  action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry')),
                ),
              ),
            );
          }

          final List<Map<String, dynamic>> items = snapshot.data ?? <Map<String, dynamic>>[];
          final List<Map<String, dynamic>> filtered = items.where((Map<String, dynamic> thread) {
            if (_query.trim().isEmpty) return true;
            final String query = _query.toLowerCase();
            final String haystack = <String>[
              thread['subject']?.toString() ?? '',
              (thread['latestMessage'] as Map<String, dynamic>?)?['body']?.toString() ?? '',
              (thread['participants'] as List<dynamic>? ?? const <dynamic>[]).join(' '),
            ].join(' ').toLowerCase();
            return haystack.contains(query);
          }).toList();

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
              children: <Widget>[
                const PatientHeroCard(
                  badge: 'Secure messaging',
                  title: 'Your care conversations',
                  subtitle: 'Pull to refresh when you are waiting on a reply from the care team.',
                ),
                const SizedBox(height: 18),
                PatientCard(
                  child: TextField(
                    onChanged: (String value) => setState(() => _query = value),
                    decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Search by provider, topic, or message'),
                  ),
                ),
                const SizedBox(height: 18),
                if (filtered.isEmpty)
                  const PatientEmptyState(
                    title: 'No conversations match this view',
                    body: 'Open appointment details or telehealth screens to message the care team.',
                    icon: Icons.chat_bubble_outline,
                  ),
                ...filtered.map((Map<String, dynamic> thread) {
                  final Map<String, dynamic>? latest = thread['latestMessage'] as Map<String, dynamic>?;
                  final List<dynamic> participants = thread['participants'] as List<dynamic>? ?? <dynamic>[];
                  final String threadId = thread['threadId']?.toString() ?? thread['id']?.toString() ?? '';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: PatientCard(
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        onTap: threadId.isEmpty ? null : () => context.go('/messages/thread?id=$threadId'),
                        leading: CircleAvatar(backgroundColor: const Color(0xFFE0F2FE), child: Text(_initials(thread['subject']?.toString() ?? 'T'))),
                        title: Text(thread['subject']?.toString() ?? 'Conversation', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                        subtitle: Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(latest?['body']?.toString() ?? 'No messages yet', maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                              const SizedBox(height: 8),
                              Text(participants.isNotEmpty ? participants.join(' • ') : 'Care team conversation', style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: <Widget>[
                            Text(_formatDate(latest?['createdAt']), style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: 8),
                            const Icon(Icons.chevron_right),
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

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String _formatDate(dynamic value) {
  final DateTime? date = _parseDate(value);
  if (date == null) return 'Just now';
  final DateTime local = date.toLocal();
  return '${local.month}/${local.day}';
}

String _initials(String value) {
  final List<String> parts = value.trim().split(RegExp(r'\s+')).where((String part) => part.isNotEmpty).toList();
  if (parts.isEmpty) return 'C';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1)).toUpperCase();
}
