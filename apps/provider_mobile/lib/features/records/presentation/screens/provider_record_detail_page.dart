import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderRecordDetailPage extends StatefulWidget {
  const ProviderRecordDetailPage({required this.recordId, super.key});

  final String recordId;

  @override
  State<ProviderRecordDetailPage> createState() => _ProviderRecordDetailPageState();
}

class _ProviderRecordDetailPageState extends State<ProviderRecordDetailPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.recordDetail(widget.recordId);
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.recordDetail(widget.recordId));

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['item', 'record', 'data']);
        final Map<String, dynamic> summary = asMap(item['summary']);
        final Map<String, dynamic> content = asMap(item['content']);
        final List<_KeyValueItem> sections = _collectDetailRows(item, summary, content);
        final List<Map<String, dynamic>> attachments = _extractAttachments(content);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(summary, const <String>['title', 'recordType'], fallback: readString(content, const <String>['recordType'], fallback: 'Medical record')),
                  subtitle: readString(item, const <String>['patientName'], fallback: 'Clinical chart entry'),
                  badge: readString(content, const <String>['recordType'], fallback: readString(summary, const <String>['recordType', 'type'], fallback: 'Record')),
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      OutlinedButton.icon(
                        onPressed: () => context.go(buildChartRoute(item)),
                        icon: const Icon(Icons.folder_shared_rounded),
                        label: const Text('Patient chart'),
                      ),
                      FilledButton.icon(
                        onPressed: () => context.go(buildEncounterRoute(item)),
                        icon: const Icon(Icons.edit_note_rounded),
                        label: const Text('New note'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Created', value: formatDateTimeLabel(readString(item, const <String>['createdAt'], fallback: ''))),
                      _InfoRow(label: 'Updated', value: formatDateTimeLabel(readString(item, const <String>['updatedAt'], fallback: ''))),
                      _InfoRow(label: 'Provider', value: readString(item, const <String>['providerName'], fallback: '—')),
                      _InfoRow(label: 'Appointment', value: readString(item, const <String>['appointmentId'], fallback: '—')),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Clinical details'),
                const SizedBox(height: 12),
                if (sections.isEmpty)
                  const EmptyStateCard(
                    title: 'No structured details found',
                    subtitle: 'This record does not expose additional structured fields through the current API payload.',
                    icon: Icons.article_outlined,
                  )
                else
                  ProviderCard(
                    child: Column(
                      children: <Widget>[
                        for (int i = 0; i < sections.length; i++) ...<Widget>[
                          _InfoRow(label: sections[i].label, value: sections[i].value),
                          if (i != sections.length - 1) const Divider(height: 18),
                        ],
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Attachments and evidence'),
                const SizedBox(height: 12),
                if (attachments.isEmpty)
                  const EmptyStateCard(
                    title: 'No attachments linked',
                    subtitle: 'Attachment metadata will appear here when records include uploaded files or evidence links.',
                    icon: Icons.attach_file_rounded,
                  )
                else
                  ...attachments.map((file) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Padding(
                                padding: EdgeInsets.only(top: 3),
                                child: Icon(Icons.insert_drive_file_outlined),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(file, const <String>['name', 'fileName', 'title'], fallback: 'Attachment'), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(file, const <String>['type', 'mimeType', 'category'], fallback: 'Linked evidence')),
                                    const SizedBox(height: 6),
                                    Text(readString(file, const <String>['url', 'href', 'path'], fallback: 'No external URL exposed')),
                                  ],
                                ),
                              ),
                            ],
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

  List<_KeyValueItem> _collectDetailRows(Map<String, dynamic> item, Map<String, dynamic> summary, Map<String, dynamic> content) {
    final List<_KeyValueItem> rows = <_KeyValueItem>[
      _KeyValueItem('Summary', readString(summary, const <String>['title', 'type'], fallback: '')),
      _KeyValueItem('Record type', readString(content, const <String>['recordType'], fallback: readString(summary, const <String>['recordType', 'type'], fallback: ''))),
      _KeyValueItem('Subjective', readString(content, const <String>['subjective'], fallback: '')),
      _KeyValueItem('Objective', readString(content, const <String>['objective'], fallback: '')),
      _KeyValueItem('Assessment', readString(content, const <String>['assessment'], fallback: '')),
      _KeyValueItem('Plan', readString(content, const <String>['plan'], fallback: '')),
      _KeyValueItem('Diagnosis code', readString(content, const <String>['diagnosisCode'], fallback: '')),
      _KeyValueItem('Medication', readString(content, const <String>['drug'], fallback: '')),
      _KeyValueItem('Dosage', readString(content, const <String>['dosage'], fallback: '')),
      _KeyValueItem('Frequency', readString(content, const <String>['frequency'], fallback: '')),
      _KeyValueItem('Duration', readString(content, const <String>['duration'], fallback: '')),
      _KeyValueItem('Pharmacy', readString(content, const <String>['pharmacyName'], fallback: '')),
      _KeyValueItem('Test name', readString(content, const <String>['testName'], fallback: '')),
      _KeyValueItem('Release status', readString(content, const <String>['fulfillmentStatus', 'prescriptionStatus', 'secondReviewStatus'], fallback: '')),
      _KeyValueItem('Clinical note', readString(content, const <String>['note'], fallback: '')),
      _KeyValueItem('Patient visible', readBool(content, const <String>['patientVisible', 'releasedToPatient']) ? 'Yes' : ''),
      _KeyValueItem('Verified', readBool(content, const <String>['verified']) ? 'Yes' : ''),
      _KeyValueItem('Released at', formatDateTimeLabel(readString(content, const <String>['releasedAt', 'verifiedAt'], fallback: ''))),
      _KeyValueItem('Linked patient', readString(item, const <String>['patientName'], fallback: '')),
    ];

    return rows.where((row) => row.value.trim().isNotEmpty && row.value.trim() != '—').toList();
  }

  List<Map<String, dynamic>> _extractAttachments(Map<String, dynamic> content) {
    final List<Map<String, dynamic>> attachments = <Map<String, dynamic>>[];
    const List<String> candidates = <String>['attachments', 'documents', 'files', 'evidenceFiles', 'reports'];
    for (final String key in candidates) {
      final dynamic raw = content[key];
      if (raw is List) {
        attachments.addAll(raw.whereType<dynamic>().map<Map<String, dynamic>>((dynamic item) {
          if (item is Map<String, dynamic>) return item;
          if (item is Map) return item.map((dynamic k, dynamic v) => MapEntry(k.toString(), v));
          return <String, dynamic>{'name': item.toString()};
        }));
      }
    }
    return attachments;
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 112, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}

class _KeyValueItem {
  const _KeyValueItem(this.label, this.value);

  final String label;
  final String value;
}
