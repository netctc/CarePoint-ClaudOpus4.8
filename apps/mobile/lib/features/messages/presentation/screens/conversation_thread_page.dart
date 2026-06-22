import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';

class ConversationThreadPage extends StatefulWidget {
  const ConversationThreadPage({super.key, this.threadId});

  final String? threadId;

  @override
  State<ConversationThreadPage> createState() => _ConversationThreadPageState();
}

class _ConversationThreadPageState extends State<ConversationThreadPage> {
  final TextEditingController _controller = TextEditingController();
  late Future<Map<String, dynamic>> _future;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    if (widget.threadId == null || widget.threadId!.isEmpty) {
      throw Exception('No conversation id was provided.');
    }
    return AppSession.instance.thread(widget.threadId!);
  }

  Future<void> _refresh() async {
    final Future<Map<String, dynamic>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _send() async {
    if (widget.threadId == null || _controller.text.trim().isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await AppSession.instance.sendMessage(widget.threadId!, _controller.text.trim());
      _controller.clear();
      await _refresh();
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Conversation'), centerTitle: true),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _ErrorState(error: snapshot.error.toString(), onRetry: _refresh);
          }

          final Map<String, dynamic> thread = snapshot.data ?? <String, dynamic>{};
          final List<Map<String, dynamic>> messages = (thread['messages'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final List<dynamic> participants = thread['participants'] as List<dynamic>? ?? <dynamic>[];
          final Map<String, dynamic>? urgentEscalation = (thread['urgentEscalation'] as Map?)?.cast<String, dynamic>();

          return Column(
            children: <Widget>[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 14),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(thread['subject']?.toString() ?? 'Care team conversation', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(participants.isNotEmpty ? participants.join(' • ') : 'Secure message channel', style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              if (urgentEscalation != null)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Urgent symptom guidance', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text('Detected symptoms: ${((urgentEscalation['symptoms'] as List?) ?? <dynamic>[]).join(', ')}'),
                      const SizedBox(height: 4),
                      Text(urgentEscalation['guidance']?.toString() ?? 'Seek urgent medical attention for severe or worsening symptoms.'),
                      const SizedBox(height: 4),
                      Text('Status: ${urgentEscalation['status'] ?? 'OPEN'}'),
                      if ((urgentEscalation['safetyCaseId']?.toString() ?? '').isNotEmpty)
                        Text('Safety case: ${urgentEscalation['safetyCaseId']}'),
                    ],
                  ),
                ),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView.separated(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(20),
                    itemCount: messages.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (BuildContext context, int index) {
                      final Map<String, dynamic> message = messages[index];
                      final bool isMine = message['isMine'] == true;
                      return Align(
                        alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 320),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isMine ? AppColors.primary : Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: isMine ? AppColors.primary : AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  message['senderName']?.toString() ?? (isMine ? 'You' : 'Care team'),
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: isMine ? Colors.white70 : AppColors.textSecondary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  message['body']?.toString() ?? '',
                                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: isMine ? Colors.white : AppColors.textPrimary),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  _formatDateTime(message['createdAt']),
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: isMine ? Colors.white70 : AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              SafeArea(
                minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: TextField(
                        controller: _controller,
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Type a secure message',
                          filled: true,
                          fillColor: Colors.white,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(color: AppColors.border),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(color: AppColors.border),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: _sending ? null : _send,
                      child: Text(_sending ? 'Sending…' : 'Send'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
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
            const Icon(Icons.error_outline, size: 40, color: Colors.redAccent),
            const SizedBox(height: 12),
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String _formatDateTime(dynamic value) {
  final DateTime? date = _parseDate(value);
  if (date == null) return 'Pending';
  final DateTime local = date.toLocal();
  String two(int part) => part.toString().padLeft(2, '0');
  return '${local.month}/${local.day}/${local.year} ${two(local.hour)}:${two(local.minute)}';
}
