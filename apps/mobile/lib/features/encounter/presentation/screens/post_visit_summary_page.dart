import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_primary_button.dart';

class PostVisitSummaryPage extends StatefulWidget {
  const PostVisitSummaryPage({super.key, this.appointmentId});

  final String? appointmentId;

  @override
  State<PostVisitSummaryPage> createState() => _PostVisitSummaryPageState();
}

class _PostVisitSummaryPageState extends State<PostVisitSummaryPage> {
  late Future<_SummaryPayload> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_SummaryPayload> _load() async {
    final List<dynamic> records = (await AppSession.instance.records())['items'] as List<dynamic>? ?? <dynamic>[];
    final List<dynamic> appointments = (await AppSession.instance.appointments())['items'] as List<dynamic>? ?? <dynamic>[];
    final List<Map<String, dynamic>> recordItems = records.whereType<Map<String, dynamic>>().toList();
    final List<Map<String, dynamic>> appointmentItems = appointments.whereType<Map<String, dynamic>>().toList();
    Map<String, dynamic>? appointment;
    if (widget.appointmentId != null && widget.appointmentId!.isNotEmpty) {
      appointment = appointmentItems.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? item) => item?['id']?.toString() == widget.appointmentId, orElse: () => null);
    }
    appointment ??= appointmentItems.isNotEmpty ? appointmentItems.first : null;
    final Map<String, dynamic>? record = recordItems.isNotEmpty ? recordItems.first : null;
    return _SummaryPayload(appointment: appointment, record: record);
  }

  Future<void> _reload() async {
    final Future<_SummaryPayload> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Post-Visit Summary'), centerTitle: true),
      body: FutureBuilder<_SummaryPayload>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_SummaryPayload> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return _ErrorState(error: snapshot.error.toString(), onRetry: _reload);
          final _SummaryPayload payload = snapshot.data ?? const _SummaryPayload();
          final Map<String, dynamic>? appointment = payload.appointment;
          final Map<String, dynamic>? record = payload.record;
          final Map<String, dynamic>? summary = record?['summary'] as Map<String, dynamic>?;
          final Map<String, dynamic>? content = record?['content'] as Map<String, dynamic>?;
          return SafeArea(
            child: RefreshIndicator(
              onRefresh: _reload,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: <Color>[Color(0xFFECFEFF), Color(0xFFE8F7FD)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text('Visit completed', style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.primaryDark)),
                          const SizedBox(height: 6),
                          Text(appointment?['providerName']?.toString() ?? record?['providerName']?.toString() ?? 'Care provider', style: Theme.of(context).textTheme.headlineMedium),
                          const SizedBox(height: 6),
                          Text('${appointment?['service']?.toString() ?? summary?['title']?.toString() ?? 'Clinical summary'} · ${_formatDate(_parseDate(appointment?['startsAt']))}', style: Theme.of(context).textTheme.bodyLarge),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _SummarySection(
                      title: 'Released note',
                      children: <Widget>[
                        _BulletLine(content?['notes']?.toString() ?? 'The final released note will appear here once the provider signs and publishes it.'),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _SummarySection(
                      title: 'Patient guidance',
                      children: <Widget>[
                        _BulletLine(summary?['title']?.toString() ?? 'Continue with the care plan shared during your visit.'),
                        _BulletLine('Open your records hub for the full released document and future updates.'),
                        _BulletLine('Use messages for follow-up questions that do not require urgent care.'),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.border)),
                      child: Row(
                        children: <Widget>[
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
                            child: const Icon(Icons.description_outlined, color: AppColors.primary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text('Released summary source', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18)),
                                const SizedBox(height: 4),
                                Text(record == null ? 'No released record yet. This view will update automatically when one becomes available.' : 'This summary is using the live records API.', style: Theme.of(context).textTheme.bodyMedium),
                              ],
                            ),
                          ),
                          OutlinedButton(onPressed: () => context.go('/records/hub'), child: const Text('Open')),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            AppPrimaryButton(label: 'Book Follow-Up Visit', onPressed: () => context.go('/providers/search')),
            const SizedBox(height: 12),
            Row(
              children: <Widget>[
                Expanded(child: OutlinedButton(onPressed: () => context.go('/records/hub'), child: const Text('Open Records'))),
                const SizedBox(width: 12),
                Expanded(child: OutlinedButton(onPressed: () => context.go('/messages/inbox'), child: const Text('Message care team'))),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryPayload {
  const _SummaryPayload({this.appointment, this.record});

  final Map<String, dynamic>? appointment;
  final Map<String, dynamic>? record;
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: AppColors.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _BulletLine extends StatelessWidget {
  const _BulletLine(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(width: 8, height: 8, margin: const EdgeInsets.only(top: 7), decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyLarge)),
        ],
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
            const Icon(Icons.summarize_outlined, size: 42, color: AppColors.textSecondary),
            const SizedBox(height: 12),
            Text('Could not load the visit summary.', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(error, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: () { onRetry(); }, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString())?.toLocal();
}

String _formatDate(DateTime? value) {
  if (value == null) return 'Date pending';
  final String month = <String>['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][value.month - 1];
  return '$month ${value.day}, ${value.year}';
}
