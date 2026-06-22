import 'package:flutter/material.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class DocumentDetailPage extends StatefulWidget {
  const DocumentDetailPage({super.key, this.documentId});

  final String? documentId;

  @override
  State<DocumentDetailPage> createState() => _DocumentDetailPageState();
}

class _DocumentDetailPageState extends State<DocumentDetailPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final Map<String, dynamic> response = await AppSession.instance.records();
    final List<Map<String, dynamic>> items = (response['items'] as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final Map<String, dynamic>? item = items.cast<Map<String, dynamic>?>().firstWhere((Map<String, dynamic>? record) => record?['id']?.toString() == widget.documentId, orElse: () => null);
    if (item == null) {
      throw Exception('Document not found');
    }
    return item;
  }

  Future<void> _refresh() async {
    final Future<Map<String, dynamic>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Document detail',
      subtitle: 'Released note, attachment summary, and source context',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to open document', body: snapshot.error.toString(), icon: Icons.insert_drive_file_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final Map<String, dynamic> item = snapshot.data ?? <String, dynamic>{};
          final Map<String, dynamic> summary = (item['summary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
          final List<dynamic> sections = item['sections'] as List<dynamic>? ?? <dynamic>[];
          final List<dynamic> attachments = item['attachments'] as List<dynamic>? ?? <dynamic>[];
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: item['type']?.toString().toUpperCase() ?? 'RECORD',
                title: summary['title']?.toString() ?? item['title']?.toString() ?? 'Released document',
                subtitle: summary['subtitle']?.toString() ?? 'Review the released content, context, and attachments below.',
              ),
              const SizedBox(height: 18),
              Row(
                children: <Widget>[
                  Expanded(child: PatientMetricCard(label: 'Sections', value: '${sections.length}', caption: 'Released content blocks', icon: Icons.article_outlined)),
                  const SizedBox(width: 12),
                  Expanded(child: PatientMetricCard(label: 'Attachments', value: '${attachments.length}', caption: 'Files and references', icon: Icons.attach_file_outlined)),
                ],
              ),
              const SizedBox(height: 18),
              PatientCard(
                child: Column(
                  children: <Widget>[
                    PatientInfoRow(label: 'Source', value: item['providerName']?.toString() ?? 'CarePoint clinician', icon: Icons.person_outline),
                    PatientInfoRow(label: 'Released at', value: item['createdAt']?.toString() ?? 'Available in records', icon: Icons.schedule_outlined),
                    PatientInfoRow(label: 'Category', value: item['type']?.toString() ?? 'Record', icon: Icons.category_outlined),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Document body'),
              const SizedBox(height: 12),
              PatientCard(
                child: sections.isEmpty
                    ? Text(item['note']?.toString() ?? 'This released document does not include sectioned content.')
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: sections.map((dynamic rawSection) {
                          final Map<String, dynamic> section = rawSection is Map ? rawSection.cast<String, dynamic>() : <String, dynamic>{};
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(section['title']?.toString() ?? 'Section', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 6),
                                Text(section['body']?.toString() ?? section['value']?.toString() ?? ''),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Attachments'),
              const SizedBox(height: 12),
              PatientCard(
                child: attachments.isEmpty
                    ? const Text('No released attachments were included with this document.')
                    : Column(
                        children: attachments.map((dynamic rawAttachment) {
                          final Map<String, dynamic> attachment = rawAttachment is Map ? rawAttachment.cast<String, dynamic>() : <String, dynamic>{};
                          return PatientInfoRow(label: attachment['title']?.toString() ?? 'Attachment', value: attachment['description']?.toString() ?? attachment['type']?.toString() ?? 'Released file', icon: Icons.attach_file_outlined);
                        }).toList(),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}
