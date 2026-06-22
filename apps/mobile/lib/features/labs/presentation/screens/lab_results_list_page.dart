import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class LabResultsListPage extends StatefulWidget {
  const LabResultsListPage({super.key});

  @override
  State<LabResultsListPage> createState() => _LabResultsListPageState();
}

class _LabResultsListPageState extends State<LabResultsListPage> {
  late Future<List<Map<String, dynamic>>> _future;
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
    final Future<List<Map<String, dynamic>>> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.patientLabs();
    final List<Map<String, dynamic>> items = (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    items.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final DateTime first = _parseDate(a['releasedAt'] ?? a['collectedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      final DateTime second = _parseDate(b['releasedAt'] ?? b['collectedAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
      return second.compareTo(first);
    });
    return items;
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<List<Map<String, dynamic>>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      currentIndex: 3,
      title: 'Lab results',
      subtitle: 'Released results, trends, and follow-up guidance',
      showBack: true,
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load labs', body: snapshot.error.toString(), icon: Icons.science_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final List<Map<String, dynamic>> items = snapshot.data ?? <Map<String, dynamic>>[];
          final int abnormal = items.where((Map<String, dynamic> item) => ((item['flaggedCount'] as num?)?.toInt() ?? 0) > 0).length;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(
                  badge: '${items.length} results',
                  title: 'Track your latest lab findings',
                  subtitle: 'Open each result to see analytes, flagged values, history, and clinician guidance.',
                ),
                const SizedBox(height: 18),
                if (!AppSession.instance.isSelfSubject) ...<Widget>[
                  PatientActiveProfileCard(label: AppSession.instance.activeSubjectLabel, relationship: AppSession.instance.activeSubjectRelationship),
                  const SizedBox(height: 18),
                ],
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Released', value: '${items.length}', caption: 'Available in your record', icon: Icons.folder_open_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Needs attention', value: '$abnormal', caption: 'One or more values flagged', icon: Icons.warning_amber_outlined)),
                  ],
                ),
                const SizedBox(height: 18),
                if (items.isEmpty)
                  const PatientEmptyState(title: 'No released lab results', body: 'Data source: released provider/lab results from /api/records/patient-labs. Patient-uploaded diagnostic reports are shown on Home and Profile until released as lab records.')
                else
                  ...items.map((Map<String, dynamic> item) {
                    final String id = item['labResultId']?.toString() ?? item['id']?.toString() ?? '';
                    final int flaggedCount = (item['flaggedCount'] as num?)?.toInt() ?? 0;
                    final String statusLabel = flaggedCount > 0 ? '$flaggedCount flagged' : (item['status']?.toString().replaceAll('_', ' ') ?? 'Released');
                    final String releasedLabel = _formatDate(item['releasedAt'] ?? item['collectedAt']);
                    final String reviewLabel = item['secondReviewStatus']?.toString().replaceAll('_', ' ') ?? 'Not required';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PatientCard(
                        child: InkWell(
                          onTap: id.isEmpty ? null : () => context.go('/labs/detail?id=$id'),
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(item['title']?.toString() ?? item['testName']?.toString() ?? 'Lab result', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                                  PatientStatusBadge(label: statusLabel),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(item['guidance']?.toString() ?? 'Open for detailed interpretation.', style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: <Widget>[
                                  PatientTag(label: releasedLabel, icon: Icons.schedule_outlined),
                                  PatientTag(label: reviewLabel, icon: Icons.verified_outlined),
                                  PatientTag(label: '${(item['values'] as List?)?.length ?? 0} analytes', icon: Icons.biotech_outlined),
                                ],
                              ),
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
  return DateTime.tryParse(value.toString())?.toLocal();
}

String _formatDate(dynamic value) {
  final DateTime? parsed = _parseDate(value);
  if (parsed == null) return 'Release date pending';
  return DateFormat('EEE, d MMM • h:mm a').format(parsed);
}
