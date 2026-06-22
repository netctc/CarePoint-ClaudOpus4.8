import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class LabResultDetailPage extends StatefulWidget {
  const LabResultDetailPage({super.key, this.resultId});

  final String? resultId;

  @override
  State<LabResultDetailPage> createState() => _LabResultDetailPageState();
}

class _LabResultDetailPageState extends State<LabResultDetailPage> {
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
    final String id = widget.resultId ?? '';
    if (id.isEmpty) throw Exception('Missing lab result identifier');
    final Map<String, dynamic> response = await AppSession.instance.patientLabDetail(id);
    return (response['item'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<Map<String, dynamic>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Lab detail',
      subtitle: 'Interpretation, analytes, and longitudinal review',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load lab detail', body: snapshot.error.toString(), icon: Icons.science_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final Map<String, dynamic> item = snapshot.data ?? <String, dynamic>{};
          final List<Map<String, dynamic>> values = (item['values'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final List<dynamic> comments = item['comments'] as List<dynamic>? ?? <dynamic>[];
          final List<Map<String, dynamic>> history = (item['history'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
          final int flaggedCount = (item['flaggedCount'] as num?)?.toInt() ?? 0;
          final String reviewStatus = item['secondReviewStatus']?.toString().replaceAll('_', ' ') ?? 'Not required';
          final Map<String, dynamic>? firstValue = values.isEmpty ? null : values.first;
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: flaggedCount > 0 ? '$flaggedCount flagged value${flaggedCount == 1 ? '' : 's'}' : (item['status']?.toString().replaceAll('_', ' ') ?? 'Released'),
                title: item['title']?.toString() ?? item['testName']?.toString() ?? 'Lab result',
                subtitle: item['guidance']?.toString() ?? 'Review the analytes and your care-team comments below.',
              ),
              const SizedBox(height: 18),
              Row(
                children: <Widget>[
                  Expanded(
                    child: PatientMetricCard(
                      label: 'Flagged values',
                      value: '$flaggedCount',
                      caption: 'Out of range or abnormal',
                      icon: Icons.warning_amber_outlined,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PatientMetricCard(
                      label: 'Second review',
                      value: reviewStatus,
                      caption: 'Clinical review status',
                      icon: Icons.verified_outlined,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Result overview'),
              const SizedBox(height: 12),
              PatientCard(
                child: Column(
                  children: <Widget>[
                    PatientInfoRow(label: 'Test name', value: item['testName']?.toString() ?? item['title']?.toString() ?? 'Lab result', icon: Icons.science_outlined),
                    PatientInfoRow(label: 'Collected', value: _formatDate(item['collectedAt']), icon: Icons.schedule_outlined),
                    PatientInfoRow(label: 'Released', value: _formatDate(item['releasedAt']), icon: Icons.upload_file_outlined),
                    PatientInfoRow(label: 'Provider', value: item['providerName']?.toString() ?? 'Care team', icon: Icons.person_outline),
                    PatientInfoRow(label: 'Patient visibility', value: item['patientVisible'] == true ? 'Visible in portal' : 'Not released yet', icon: Icons.visibility_outlined),
                    if (firstValue != null)
                      PatientInfoRow(
                        label: 'Primary analyte',
                        value: '${firstValue['label'] ?? 'Analyte'} • ${firstValue['value'] ?? '--'} ${firstValue['unit'] ?? ''}'.trim(),
                        icon: Icons.biotech_outlined,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Analytes'),
              const SizedBox(height: 12),
              PatientCard(
                child: values.isEmpty
                    ? const Text('No analyte breakdown was included with this result.')
                    : Column(
                        children: values.map((Map<String, dynamic> entry) {
                          final String flag = entry['flag']?.toString().trim() ?? '';
                          final String valueLabel = '${entry['value'] ?? '--'} ${entry['unit'] ?? ''}'.trim();
                          final String reference = entry['referenceRange']?.toString() ?? 'Reference range not provided';
                          final String combined = flag.isEmpty ? '$valueLabel • $reference' : '$valueLabel • $reference • $flag';
                          return PatientInfoRow(
                            label: entry['label']?.toString() ?? 'Analyte',
                            value: combined,
                            icon: Icons.monitor_heart_outlined,
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'History'),
              const SizedBox(height: 12),
              PatientCard(
                child: history.isEmpty
                    ? const Text('No prior result history was available for this test.')
                    : Column(
                        children: history.map((Map<String, dynamic> entry) => PatientInfoRow(
                          label: _formatDate(entry['releasedAt']),
                          value: '${entry['valueSummary'] ?? 'No analyte summary'} • ${(entry['flaggedCount'] as num?)?.toInt() ?? 0} flagged',
                          icon: Icons.timeline_outlined,
                        )).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Care team comments'),
              const SizedBox(height: 12),
              PatientCard(
                child: comments.isEmpty
                    ? const Text('No clinician comment was attached to this result.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: comments.map((dynamic note) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text('• ${note.toString()}'),
                        )).toList(),
                      ),
              ),
            ],
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
  if (parsed == null) return 'Not available';
  return DateFormat('EEE, d MMM yyyy • h:mm a').format(parsed);
}
