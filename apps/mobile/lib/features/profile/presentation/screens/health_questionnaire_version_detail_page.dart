import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class HealthQuestionnaireVersionDetailPage extends StatefulWidget {
  const HealthQuestionnaireVersionDetailPage({super.key, required this.versionId});

  final String versionId;

  @override
  State<HealthQuestionnaireVersionDetailPage> createState() => _HealthQuestionnaireVersionDetailPageState();
}

class _HealthQuestionnaireVersionDetailPageState extends State<HealthQuestionnaireVersionDetailPage> {
  late Future<Map<String, dynamic>> _future;
  late String _subjectKey;

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
    final Future<Map<String, dynamic>> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<Map<String, dynamic>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.questionnaireVersion(widget.versionId);
    return (response['item'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Questionnaire version',
      subtitle: 'Detailed review of a previous submission',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(
                title: 'Unable to load questionnaire version',
                body: snapshot.error.toString(),
                icon: Icons.quiz_outlined,
                action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry')),
              ),
            );
          }
          final item = snapshot.data ?? <String, dynamic>{};
          final questionnaire = ((item['questionnaire'] as Map?)?.cast<String, dynamic>()) ?? <String, dynamic>{};
          final completion = (item['completion'] as Map<String, dynamic>?) ?? <String, dynamic>{};
          final entries = <MapEntry<String, String?>>[
            MapEntry('Blood type', questionnaire['bloodType']?.toString()),
            MapEntry('Allergies', questionnaire['allergies']?.toString()),
            MapEntry('Chronic conditions', questionnaire['chronicConditions']?.toString()),
            MapEntry('Current medications', questionnaire['currentMedications']?.toString()),
            MapEntry('Past surgeries', questionnaire['pastSurgeries']?.toString()),
            MapEntry('Smoking status', questionnaire['smokingStatus']?.toString()),
            MapEntry('Pregnancy status', questionnaire['pregnancyStatus']?.toString()),
            MapEntry('Height', questionnaire['heightCm'] == null ? null : '${questionnaire['heightCm']} cm'),
            MapEntry('Weight', questionnaire['weightKg'] == null ? null : '${questionnaire['weightKg']} kg'),
            MapEntry('Emergency notes', questionnaire['emergencyNotes']?.toString()),
          ].where((entry) => (entry.value ?? '').trim().isNotEmpty).toList();
          final completed = (completion['completedCount'] as num?)?.toInt() ?? 0;
          final total = (completion['totalCount'] as num?)?.toInt() ?? 10;
          final percent = total == 0 ? 0 : ((completed / total) * 100).round();

          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: 'Version ${item['versionNumber'] ?? 1}',
                  title: 'Submission details',
                  subtitle: '${_submittedAt(item['submittedAt'])} • $completed/$total fields completed',
                ),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Completion', value: '$percent%', caption: '$completed of $total fields', icon: Icons.fact_check_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Profile', value: AppSession.instance.activeSubjectLabel, caption: item['subjectRelationship']?.toString() ?? 'Self', icon: Icons.person_outline)),
                  ],
                ),
                if ((item['summary']?.toString() ?? '').isNotEmpty) ...<Widget>[
                  const SizedBox(height: 18),
                  PatientCard(child: Text(item['summary'].toString())),
                ],
                const SizedBox(height: 18),
                PatientSectionTitle(title: 'Questionnaire answers'),
                const SizedBox(height: 12),
                if (entries.isEmpty)
                  const PatientEmptyState(
                    title: 'No questionnaire fields available',
                    body: 'This version does not contain any answer fields to display.',
                    icon: Icons.info_outline,
                  )
                else
                  ...entries.map((entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: PatientCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(entry.key, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
                              const SizedBox(height: 6),
                              Text(entry.value ?? '--'),
                            ],
                          ),
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

String _submittedAt(dynamic value) {
  final DateTime? parsed = value == null ? null : DateTime.tryParse(value.toString())?.toLocal();
  if (parsed == null) return 'Submission date unavailable';
  return DateFormat('EEE, d MMM yyyy • h:mm a').format(parsed);
}
