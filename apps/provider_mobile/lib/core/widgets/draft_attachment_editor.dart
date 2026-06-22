import 'package:flutter/material.dart';

import 'provider_ui.dart';

class DraftAttachmentEditor extends StatelessWidget {
  const DraftAttachmentEditor({
    required this.attachments,
    required this.onChanged,
    this.title = 'Attachment staging',
    this.subtitle = 'Stage evidence metadata locally for mobile handoff. These items are kept on-device until a dedicated attachment endpoint is finalized.',
    super.key,
  });

  final List<Map<String, dynamic>> attachments;
  final ValueChanged<List<Map<String, dynamic>>> onChanged;
  final String title;
  final String subtitle;

  Future<void> _addAttachment(BuildContext context) async {
    final TextEditingController titleController = TextEditingController();
    final TextEditingController typeController = TextEditingController(text: 'document');
    final TextEditingController referenceController = TextEditingController();
    final TextEditingController noteController = TextEditingController();

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Add attachment reference'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              TextField(controller: titleController, decoration: const InputDecoration(labelText: 'Title')),
              const SizedBox(height: 12),
              TextField(controller: typeController, decoration: const InputDecoration(labelText: 'Type')), 
              const SizedBox(height: 12),
              TextField(controller: referenceController, decoration: const InputDecoration(labelText: 'Reference or secure link')),
              const SizedBox(height: 12),
              TextField(controller: noteController, decoration: const InputDecoration(labelText: 'Note'), maxLines: 3),
            ],
          ),
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Add')),
        ],
      ),
    );

    if (confirmed == true && titleController.text.trim().isNotEmpty) {
      final List<Map<String, dynamic>> updated = <Map<String, dynamic>>[
        ...attachments,
        <String, dynamic>{
          'title': titleController.text.trim(),
          'type': typeController.text.trim().isEmpty ? 'document' : typeController.text.trim(),
          'reference': referenceController.text.trim(),
          'note': noteController.text.trim(),
          'stagedAt': DateTime.now().toUtc().toIso8601String(),
        },
      ];
      onChanged(updated);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ProviderCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
              OutlinedButton.icon(
                onPressed: () => _addAttachment(context),
                icon: const Icon(Icons.attach_file_rounded),
                label: const Text('Add'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          if (attachments.isNotEmpty) ...<Widget>[
            const SizedBox(height: 14),
            for (int index = 0; index < attachments.length; index++)
              Padding(
                padding: EdgeInsets.only(bottom: index == attachments.length - 1 ? 0 : 10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Padding(
                        padding: EdgeInsets.only(top: 4),
                        child: Icon(Icons.insert_drive_file_outlined),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(attachments[index]['title']?.toString() ?? 'Attachment', style: Theme.of(context).textTheme.titleSmall),
                            const SizedBox(height: 4),
                            Text(attachments[index]['type']?.toString() ?? 'document'),
                            if ((attachments[index]['reference']?.toString().trim() ?? '').isNotEmpty) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(attachments[index]['reference']!.toString()),
                            ],
                            if ((attachments[index]['note']?.toString().trim() ?? '').isNotEmpty) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(attachments[index]['note']!.toString()),
                            ],
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Remove',
                        onPressed: () {
                          final List<Map<String, dynamic>> updated = <Map<String, dynamic>>[...attachments]..removeAt(index);
                          onChanged(updated);
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
