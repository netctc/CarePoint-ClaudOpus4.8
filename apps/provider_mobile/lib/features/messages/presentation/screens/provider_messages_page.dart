import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderMessagesPage extends StatefulWidget {
  const ProviderMessagesPage({super.key});

  @override
  State<ProviderMessagesPage> createState() => _ProviderMessagesPageState();
}

class _ProviderMessagesPageState extends State<ProviderMessagesPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.threads();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.threads());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final List<Map<String, dynamic>> threads = pickList(snapshot.data, const <String>['threads', 'items']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Secure messaging',
                  subtitle: 'Patient, team, and operational conversations with quick mobile follow-up and cached read support.',
                  badge: 'Communications',
                ),
                const SizedBox(height: 20),
                if (threads.isEmpty)
                  const EmptyStateCard(title: 'No conversations found', subtitle: 'Message threads will appear here when available.', icon: Icons.mark_chat_unread_outlined)
                else
                  ...threads.map((thread) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(24),
                          onTap: () {
                            final String id = readString(thread, const <String>['id'], fallback: '');
                            if (id.isNotEmpty && id != '—') context.go('/messages/thread/$id');
                          },
                          child: ProviderCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Expanded(child: Text(readString(thread, const <String>['subject', 'title']), style: Theme.of(context).textTheme.titleMedium)),
                                    StatusBadge(readString(thread, const <String>['status'], fallback: 'Open')),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(readString(thread, const <String>['preview', 'lastMessage', 'snippet'], fallback: 'Open the thread to view recent messages.'), maxLines: 2, overflow: TextOverflow.ellipsis),
                                const SizedBox(height: 12),
                                Text(readString(thread, const <String>['counterparty', 'owner', 'participantName'], fallback: 'Care team')),
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
