import 'package:flutter/material.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class SupportComplaintsPage extends StatefulWidget {
  const SupportComplaintsPage({super.key});

  @override
  State<SupportComplaintsPage> createState() => _SupportComplaintsPageState();
}

class _SupportComplaintsPageState extends State<SupportComplaintsPage> {
  late Future<_SupportData> _future;
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _subjectController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<_SupportData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientSupportSummary(),
      AppSession.instance.patientSupportTickets(),
    ]);
    return _SupportData(
      summary: (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{},
      tickets: (((responses[1] as Map<String, dynamic>)['items']) as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList(),
    );
  }

  Future<void> _refresh() async {
    final Future<_SupportData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _createTicket() async {
    if (_subjectController.text.trim().isEmpty || _descriptionController.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    try {
      await AppSession.instance.createSupportTicket(subject: _subjectController.text.trim(), category: 'GENERAL', priority: 'NORMAL', description: _descriptionController.text.trim());
      _subjectController.clear();
      _descriptionController.clear();
      await _refresh();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Support & complaints',
      subtitle: 'Help requests, escalations, and response tracking',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<_SupportData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_SupportData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: PatientEmptyState(title: 'Unable to load support', body: snapshot.error.toString(), icon: Icons.support_agent_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))));
          final _SupportData data = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: '${data.tickets.length} tickets', title: 'Get help from the CarePoint team', subtitle: 'Track open requests, raise issues, and keep a written history of follow-up.'),
              const SizedBox(height: 18),
              PatientCard(child: Column(children: <Widget>[
                TextField(controller: _subjectController, decoration: const InputDecoration(labelText: 'Subject')),
                const SizedBox(height: 12),
                TextField(controller: _descriptionController, maxLines: 4, decoration: const InputDecoration(labelText: 'Describe your issue')),
                const SizedBox(height: 12),
                SizedBox(width: double.infinity, child: FilledButton(onPressed: _submitting ? null : _createTicket, child: Text(_submitting ? 'Submitting…' : 'Create support ticket'))),
              ])),
              const SizedBox(height: 18),
              ...data.tickets.map((Map<String, dynamic> ticket) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: PatientCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Row(children: <Widget>[
                    Expanded(child: Text(ticket['subject']?.toString() ?? 'Support ticket', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                    PatientStatusBadge(label: ticket['status']?.toString() ?? 'OPEN'),
                  ]),
                  const SizedBox(height: 8),
                  Text(ticket['description']?.toString() ?? ''),
                ])),
              )),
            ],
          );
        },
      ),
    );
  }
}

class _SupportData {
  const _SupportData({required this.summary, required this.tickets});
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> tickets;
}
