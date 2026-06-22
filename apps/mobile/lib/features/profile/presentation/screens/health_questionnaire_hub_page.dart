import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';
import 'profile_questionnaire_page.dart';

class HealthQuestionnaireHubPage extends StatefulWidget {
  const HealthQuestionnaireHubPage({super.key});

  @override
  State<HealthQuestionnaireHubPage> createState() => _HealthQuestionnaireHubPageState();
}

class _HealthQuestionnaireHubPageState extends State<HealthQuestionnaireHubPage> {
  late Future<_QuestionnaireHubData> _future;
  late String _subjectKey;
  bool _submitting = false;

  String get _currentSubjectKey => '${AppSession.instance.activeSubjectId ?? 'self'}|${AppSession.instance.activeSubjectLabel}';

  @override
  void initState() {
    super.initState();
    _subjectKey = _currentSubjectKey;
    AppSession.instance.addListener(_handleSessionChange);
    _future = _load();
  }

  @override
  void dispose() {
    AppSession.instance.removeListener(_handleSessionChange);
    super.dispose();
  }

  void _handleSessionChange() {
    final String nextKey = _currentSubjectKey;
    if (nextKey == _subjectKey) return;
    _subjectKey = nextKey;
    final Future<_QuestionnaireHubData> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<_QuestionnaireHubData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.questionnaireLatest(),
      AppSession.instance.questionnaireHistory(),
    ]);
    final Map<String, dynamic> latestResponse = (responses[0] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> historyResponse = (responses[1] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic>? latest = (latestResponse['item'] as Map?)?.cast<String, dynamic>();
    final List<Map<String, dynamic>> rawHistory = ((historyResponse['items'] as List<dynamic>?) ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final List<Map<String, dynamic>> history = latest == null ? rawHistory : rawHistory.where((Map<String, dynamic> item) => item['id']?.toString() != latest['id']?.toString()).toList();
    return _QuestionnaireHubData(latest: latest, history: history);
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<_QuestionnaireHubData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _startNewVersion([Map<String, dynamic>? seed]) async {
    final Map<String, dynamic> initial = Map<String, dynamic>.from(((seed?['questionnaire'] as Map?)?.cast<String, dynamic>()) ?? <String, dynamic>{});
    final Map<String, dynamic>? payload = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute<Map<String, dynamic>>(
        builder: (BuildContext context) => ProfileQuestionnairePage(initialQuestionnaire: initial),
      ),
    );
    if (!mounted || payload == null) return;
    setState(() => _submitting = true);
    try {
      await AppSession.instance.submitQuestionnaireVersion(payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Questionnaire submitted as a new version.')));
      await _refresh();
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _openVersionDetail(String id) {
    context.go('/health-questionnaire/version?id=${Uri.encodeComponent(id)}');
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Health questionnaire',
      subtitle: 'Dedicated history, latest result, and versioned submissions',
      showNavigation: false,
      showBack: true,
      actions: <Widget>[
        IconButton.filledTonal(
          onPressed: _submitting ? null : () => _startNewVersion(),
          icon: const Icon(Icons.add_task_outlined),
          tooltip: 'Start a new version',
        ),
      ],
      child: FutureBuilder<_QuestionnaireHubData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_QuestionnaireHubData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(
                title: 'Unable to load questionnaire history',
                body: snapshot.error.toString(),
                icon: Icons.quiz_outlined,
                action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry')),
              ),
            );
          }
          final _QuestionnaireHubData data = snapshot.data!;
          final Map<String, dynamic>? latest = data.latest;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: AppSession.instance.activeSubjectLabel,
                  title: latest == null ? 'No questionnaire submitted yet' : 'Latest result: version ${latest['versionNumber'] ?? 1}',
                  subtitle: latest == null
                      ? 'Start the first questionnaire version for this profile.'
                      : '${_completionText(latest)} • ${_submittedAt(latest['submittedAt'])}',
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: _submitting ? null : () => _startNewVersion(latest),
                        icon: const Icon(Icons.edit_note_outlined),
                        label: Text(_submitting ? 'Saving…' : (latest == null ? 'Start questionnaire' : 'Create new version')),
                      ),
                      if (latest != null)
                        OutlinedButton.icon(
                          onPressed: () => _openVersionDetail(latest['id']?.toString() ?? 'legacy-current'),
                          icon: const Icon(Icons.visibility_outlined),
                          label: const Text('View latest details'),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if (latest != null) ...<Widget>[
                  PatientSectionTitle(title: 'Latest questionnaire results'),
                  const SizedBox(height: 12),
                  _QuestionnaireVersionCard(
                    item: latest,
                    highlight: true,
                    onReuse: _submitting ? null : () => _startNewVersion(latest),
                    onOpen: () => _openVersionDetail(latest['id']?.toString() ?? 'legacy-current'),
                  ),
                  const SizedBox(height: 18),
                ],
                PatientSectionTitle(title: 'Previous versions'),
                const SizedBox(height: 12),
                if (data.history.isEmpty)
                  const PatientEmptyState(
                    title: 'No questionnaire history yet',
                    body: 'Each submission is saved as a new version for longitudinal tracking.',
                    icon: Icons.history_toggle_off_outlined,
                  )
                else
                  ...data.history.map((Map<String, dynamic> item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _QuestionnaireVersionCard(
                          item: item,
                          onReuse: _submitting ? null : () => _startNewVersion(item),
                          onOpen: () => _openVersionDetail(item['id']?.toString() ?? 'legacy-current'),
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

class _QuestionnaireHubData {
  const _QuestionnaireHubData({required this.latest, required this.history});
  final Map<String, dynamic>? latest;
  final List<Map<String, dynamic>> history;
}

class _QuestionnaireVersionCard extends StatelessWidget {
  const _QuestionnaireVersionCard({required this.item, this.highlight = false, this.onReuse, this.onOpen});

  final Map<String, dynamic> item;
  final bool highlight;
  final VoidCallback? onReuse;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic> questionnaire = ((item['questionnaire'] as Map?)?.cast<String, dynamic>()) ?? <String, dynamic>{};
    final List<_FieldLine> lines = <_FieldLine>[
      _FieldLine('Blood type', questionnaire['bloodType']),
      _FieldLine('Allergies', questionnaire['allergies']),
      _FieldLine('Conditions', questionnaire['chronicConditions']),
      _FieldLine('Medications', questionnaire['currentMedications']),
      _FieldLine('Surgeries', questionnaire['pastSurgeries']),
      _FieldLine('Height', questionnaire['heightCm'] == null || questionnaire['heightCm'].toString().trim().isEmpty ? null : '${questionnaire['heightCm']} cm'),
      _FieldLine('Weight', questionnaire['weightKg'] == null || questionnaire['weightKg'].toString().trim().isEmpty ? null : '${questionnaire['weightKg']} kg'),
      _FieldLine('Smoking', questionnaire['smokingStatus']),
      _FieldLine('Pregnancy', questionnaire['pregnancyStatus']),
      _FieldLine('Emergency notes', questionnaire['emergencyNotes']),
    ].where((line) => (line.value ?? '').trim().isNotEmpty).toList();

    return PatientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  'Version ${item['versionNumber'] ?? 1}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              PatientStatusBadge(label: highlight ? 'Latest' : 'Saved'),
            ],
          ),
          const SizedBox(height: 8),
          Text(_submittedAt(item['submittedAt']), style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Text(_completionText(item), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
          if ((item['summary']?.toString() ?? '').isNotEmpty) ...<Widget>[
            const SizedBox(height: 8),
            Text(item['summary'].toString()),
          ],
          if (lines.isNotEmpty) ...<Widget>[
            const SizedBox(height: 16),
            ...lines.take(6).map((line) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      SizedBox(width: 130, child: Text(line.label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700))),
                      Expanded(child: Text(line.value ?? '')),
                    ],
                  ),
                )),
          ],
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 10,
            runSpacing: 10,
            children: <Widget>[
              OutlinedButton.icon(
                onPressed: onOpen,
                icon: const Icon(Icons.visibility_outlined),
                label: const Text('View details'),
              ),
              OutlinedButton.icon(
                onPressed: onReuse,
                icon: const Icon(Icons.history_edu_outlined),
                label: const Text('Use as starting point'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FieldLine {
  const _FieldLine(this.label, this.value);
  final String label;
  final String? value;
}

String _completionText(Map<String, dynamic> item) {
  final Map<String, dynamic> completion = (item['completion'] as Map<String, dynamic>?) ?? <String, dynamic>{};
  final int completed = (completion['completedCount'] as num?)?.toInt() ?? 0;
  final int total = (completion['totalCount'] as num?)?.toInt() ?? 10;
  final int percentage = total == 0 ? 0 : ((completed / total) * 100).round();
  return '$completed/$total fields completed • $percentage%';
}

String _submittedAt(dynamic value) {
  final DateTime? parsed = value == null ? null : DateTime.tryParse(value.toString())?.toLocal();
  if (parsed == null) return 'Submission date unavailable';
  return DateFormat('EEE, d MMM yyyy • h:mm a').format(parsed);
}
