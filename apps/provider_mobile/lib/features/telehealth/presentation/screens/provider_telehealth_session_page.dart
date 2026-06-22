import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderTelehealthSessionPage extends StatefulWidget {
  const ProviderTelehealthSessionPage({required this.sessionId, super.key});

  final String sessionId;

  @override
  State<ProviderTelehealthSessionPage> createState() => _ProviderTelehealthSessionPageState();
}

class _ProviderTelehealthSessionPageState extends State<ProviderTelehealthSessionPage> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final Map<String, dynamic> response = await ProviderSession.instance.api.telehealthSessions();
    final List<Map<String, dynamic>> items = pickList(response, const <String>['items', 'sessions']);
    final Map<String, dynamic> session = items.cast<Map<String, dynamic>>().firstWhere(
          (Map<String, dynamic> item) => readString(item, const <String>['id'], fallback: '') == widget.sessionId,
          orElse: () => <String, dynamic>{},
        );
    if (session.isEmpty) {
      throw Exception('Telehealth session not found.');
    }
    return <String, dynamic>{'item': session};
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _startSession() async {
    await _runAction(() => ProviderSession.instance.api.startTelehealthSession(widget.sessionId), successMessage: 'Session marked live.');
  }

  Future<void> _endSession() async {
    await _runAction(() => ProviderSession.instance.api.endTelehealthSession(widget.sessionId), successMessage: 'Session ended.');
  }

  Future<void> _joinSession() async {
    await _runAction(() => ProviderSession.instance.api.joinTelehealthSession(widget.sessionId), successMessage: 'Join URL loaded.', showJoinDialog: true);
  }

  Future<void> _runAction(
    Future<Map<String, dynamic>> Function() action, {
    required String successMessage,
    bool showJoinDialog = false,
  }) async {
    setState(() => _submitting = true);
    try {
      final Map<String, dynamic> response = await action();
      if (!context.mounted) return;
      if (showJoinDialog) {
        final String joinUrl = readString(response, const <String>['joinUrl'], fallback: 'Join URL unavailable');
        await showDialog<void>(
          context: context,
          builder: (BuildContext context) => AlertDialog(
            title: const Text('Join telehealth session'),
            content: SelectableText(joinUrl),
            actions: <Widget>[
              TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
            ],
          ),
        );
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMessage)));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'session']);
        final String status = readString(item, const <String>['status'], fallback: 'READY');
        final bool isLive = status.toUpperCase() == 'LIVE';
        final bool isEnded = status.toUpperCase() == 'ENDED';

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['patientName', 'subjectLabel'], fallback: 'Telehealth session'),
                  subtitle: readString(item, const <String>['service'], fallback: 'Virtual care session'),
                  badge: status,
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _SessionInfoRow(label: 'Provider', value: readString(item, const <String>['providerName'], fallback: '—')),
                      _SessionInfoRow(label: 'Scheduled', value: formatDateTimeLabel(readString(item, const <String>['scheduledAt'], fallback: ''))),
                      _SessionInfoRow(label: 'Started', value: formatDateTimeLabel(readString(item, const <String>['startedAt'], fallback: ''))),
                      _SessionInfoRow(label: 'Ended', value: formatDateTimeLabel(readString(item, const <String>['endedAt'], fallback: ''))),
                      _SessionInfoRow(label: 'Vendor', value: readString(item, const <String>['vendor'], fallback: '—')),
                      _SessionInfoRow(label: 'Join URL', value: readString(item, const <String>['joinUrl'], fallback: 'URL available from join action')),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Session actions', style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 12),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _submitting || isLive || isEnded ? null : _startSession,
                              icon: const Icon(Icons.play_circle_outline_rounded),
                              label: const Text('Start'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _submitting ? null : _joinSession,
                              icon: const Icon(Icons.video_call_rounded),
                              label: const Text('Join'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: _submitting || isEnded ? null : _endSession,
                          icon: const Icon(Icons.stop_circle_outlined),
                          label: const Text('End session'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SessionInfoRow extends StatelessWidget {
  const _SessionInfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 96, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: SelectableText(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}
