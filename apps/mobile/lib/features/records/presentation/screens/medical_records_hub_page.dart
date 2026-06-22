import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class MedicalRecordsHubPage extends StatefulWidget {
  const MedicalRecordsHubPage({super.key});

  @override
  State<MedicalRecordsHubPage> createState() => _MedicalRecordsHubPageState();
}

class _MedicalRecordsHubPageState extends State<MedicalRecordsHubPage> {
  late Future<List<Map<String, dynamic>>> _future;
  String _filter = 'all';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.records();
    return (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
  }

  Future<void> _refresh() async {
    final Future<List<Map<String, dynamic>>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      currentIndex: 3,
      title: 'Records hub',
      subtitle: 'Visit summaries, released documents, and clinical history',
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load records', body: snapshot.error.toString(), icon: Icons.folder_off_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final List<Map<String, dynamic>> items = snapshot.data ?? <Map<String, dynamic>>[];
          final List<Map<String, dynamic>> filtered = items.where((Map<String, dynamic> record) => _filter == 'all' || _recordType(record) == _filter).toList();
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(badge: '${items.length} documents', title: 'Your released medical information', subtitle: 'Browse visit notes, lab documents, and prescription releases from one hub.'),
                const SizedBox(height: 18),
                if (!AppSession.instance.isSelfSubject) ...<Widget>[
                  PatientActiveProfileCard(label: AppSession.instance.activeSubjectLabel, relationship: AppSession.instance.activeSubjectRelationship),
                  const SizedBox(height: 18),
                ],
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Documents', value: '${items.length}', caption: 'Total released items', icon: Icons.description_outlined)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Labs', value: '${items.where((Map<String, dynamic> item) => _recordType(item) == 'lab').length}', caption: 'Results and attachments', icon: Icons.science_outlined)),
                  ],
                ),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    ChoiceChip(label: const Text('All'), selected: _filter == 'all', onSelected: (_) => setState(() => _filter = 'all')),
                    ChoiceChip(label: const Text('Clinical'), selected: _filter == 'record', onSelected: (_) => setState(() => _filter = 'record')),
                    ChoiceChip(label: const Text('Labs'), selected: _filter == 'lab', onSelected: (_) => setState(() => _filter = 'lab')),
                    ChoiceChip(label: const Text('Prescriptions'), selected: _filter == 'prescription', onSelected: (_) => setState(() => _filter = 'prescription')),
                  ],
                ),
                const SizedBox(height: 18),
                if (filtered.isEmpty)
                  const PatientEmptyState(title: 'No records in this view', body: 'Try a different filter or check again after your next visit.')
                else
                  ...filtered.map((Map<String, dynamic> record) {
                    final String id = record['documentId']?.toString() ?? record['id']?.toString() ?? '';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PatientCard(
                        child: InkWell(
                          onTap: id.isEmpty ? null : () => context.go('/records/document?id=$id'),
                          borderRadius: BorderRadius.circular(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text((record['summary'] as Map<String, dynamic>?)?['title']?.toString() ?? record['title']?.toString() ?? 'Released document', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                                  PatientStatusBadge(label: _recordType(record).toUpperCase()),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(record['providerName']?.toString() ?? 'CarePoint clinician', style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 8),
                              Text(_recordPreview(record), maxLines: 3, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
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
      bottomAction: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Row(
          children: <Widget>[
            Expanded(child: OutlinedButton(onPressed: () => context.go('/labs/list'), child: const Text('Labs'))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton.tonal(onPressed: () => context.go('/prescriptions/list'), child: const Text('Prescriptions'))),
          ],
        ),
      ),
    );
  }
}

String _recordType(Map<String, dynamic> record) => record['type']?.toString() ?? 'record';
String _recordPreview(Map<String, dynamic> record) => record['summary']?['subtitle']?.toString() ?? record['note']?.toString() ?? 'Open this document to review the released content.';
