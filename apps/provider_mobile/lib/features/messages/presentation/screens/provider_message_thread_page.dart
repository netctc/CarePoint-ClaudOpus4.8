import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderMessageThreadPage extends StatefulWidget {
  const ProviderMessageThreadPage({required this.threadId, super.key});

  final String threadId;

  @override
  State<ProviderMessageThreadPage> createState() => _ProviderMessageThreadPageState();
}

class _ProviderMessageThreadPageState extends State<ProviderMessageThreadPage> {
  late Future<Map<String, dynamic>> _future;
  final TextEditingController _messageController = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.thread(widget.threadId);
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.thread(widget.threadId));
  }

  Future<void> _send() async {
    if (_messageController.text.trim().isEmpty) return;
    setState(() => _sending = true);
    try {
      await ProviderSession.instance.api.sendMessage(widget.threadId, _messageController.text.trim());
      _messageController.clear();
      _refresh();
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final Map<String, dynamic> thread = pickMap(snapshot.data, const <String>['thread', 'item', 'data']);
        final List<Map<String, dynamic>> messages = pickList(thread.isEmpty ? snapshot.data : thread, const <String>['messages', 'items']);

        return SafeArea(
          top: false,
          child: Column(
            children: <Widget>[
              Expanded(
                child: RefreshIndicator(
                  onRefresh: () async => _refresh(),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                    children: <Widget>[
                      ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(readString(thread, const <String>['subject', 'title']), style: Theme.of(context).textTheme.titleLarge),
                            const SizedBox(height: 8),
                            Text(readString(thread, const <String>['owner', 'counterparty'], fallback: 'Conversation thread')),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (messages.isEmpty)
                        const EmptyStateCard(title: 'No messages yet', subtitle: 'Send a message to continue this secure conversation.')
                      else
                        ...messages.map((message) {
                          final bool internal = readBool(message, const <String>['internal'], fallback: false);
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Align(
                              alignment: internal ? Alignment.centerRight : Alignment.centerLeft,
                              child: Container(
                                constraints: const BoxConstraints(maxWidth: 320),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: internal ? Theme.of(context).colorScheme.primaryContainer : Colors.white,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: Theme.of(context).dividerColor),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(message, const <String>['author', 'sender'], fallback: 'CarePoint'), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 6),
                                    Text(readString(message, const <String>['body', 'message'], fallback: '—')),
                                    const SizedBox(height: 6),
                                    Text(readString(message, const <String>['time', 'createdAt'], fallback: ''), style: Theme.of(context).textTheme.bodySmall),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: _messageController,
                        minLines: 1,
                        maxLines: 4,
                        decoration: const InputDecoration(hintText: 'Write a secure reply'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton.icon(
                      onPressed: _sending ? null : _send,
                      icon: const Icon(Icons.send_rounded),
                      label: const Text('Send'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
