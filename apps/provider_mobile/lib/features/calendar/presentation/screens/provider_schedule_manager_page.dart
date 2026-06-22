import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderScheduleManagerPage extends StatefulWidget {
  const ProviderScheduleManagerPage({super.key});

  @override
  State<ProviderScheduleManagerPage> createState() => _ProviderScheduleManagerPageState();
}

class _ProviderScheduleManagerPageState extends State<ProviderScheduleManagerPage> {
  late Future<Map<String, dynamic>> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'templates': await api.calendarTemplates(),
      'slots': await api.calendarPublishedSlots(days: 14),
      'availability': await api.calendarAvailability(days: 14),
    };
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  Future<void> _createSlot() async {
    final _SlotFormResult? form = await _showSlotDialog();
    if (form == null) return;
    setState(() => _busy = true);
    try {
      await ProviderSession.instance.api.createPublishedSlot(form.toPayload());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Published slot created.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editTemplate(Map<String, dynamic>? template) async {
    final _TemplateFormResult? form = await _showTemplateDialog(existing: template);
    if (form == null) return;
    setState(() => _busy = true);
    try {
      final String templateId = readString(template, const <String>['id'], fallback: '');
      if (templateId.isEmpty || templateId == '—') {
        await ProviderSession.instance.api.createCalendarTemplate(form.toPayload());
      } else {
        await ProviderSession.instance.api.updateCalendarTemplate(templateId, form.toPayload());
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template saved.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _publishTemplate(String templateId) async {
    setState(() => _busy = true);
    try {
      await ProviderSession.instance.api.publishCalendarTemplate(templateId, note: 'Published from provider mobile.');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template published and slots generated.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelSlot(String slotId) async {
    setState(() => _busy = true);
    try {
      await ProviderSession.instance.api.cancelPublishedSlot(slotId, note: 'Cancelled from provider mobile.');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Published slot cancelled.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<_SlotFormResult?> _showSlotDialog() async {
    final TextEditingController serviceController = TextEditingController(text: 'Follow-up consultation');
    final TextEditingController locationController = TextEditingController(text: 'Main Clinic');
    final TextEditingController startsAtController = TextEditingController(text: DateTime.now().add(const Duration(hours: 2)).toIso8601String());
    final TextEditingController endsAtController = TextEditingController(text: DateTime.now().add(const Duration(hours: 2, minutes: 30)).toIso8601String());
    final TextEditingController capacityController = TextEditingController(text: '1');

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: const Text('Create published slot'),
        content: StatefulBuilder(
          builder: (BuildContext context, StateSetter setLocalState) {
            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  TextField(controller: serviceController, decoration: const InputDecoration(labelText: 'Service')),
                  const SizedBox(height: 12),
                  TextField(controller: locationController, decoration: const InputDecoration(labelText: 'Location')),
                  const SizedBox(height: 12),
                  TextField(controller: startsAtController, decoration: const InputDecoration(labelText: 'Starts at (ISO datetime)')),
                  const SizedBox(height: 12),
                  TextField(controller: endsAtController, decoration: const InputDecoration(labelText: 'Ends at (ISO datetime)')),
                  const SizedBox(height: 12),
                  TextField(controller: capacityController, decoration: const InputDecoration(labelText: 'Capacity'), keyboardType: TextInputType.number),
                ],
              ),
            );
          },
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Create')),
        ],
      ),
    );
    if (confirmed != true) return null;
    return _SlotFormResult(
      service: serviceController.text.trim(),
      location: locationController.text.trim(),
      startsAt: startsAtController.text.trim(),
      endsAt: endsAtController.text.trim(),
      capacity: int.tryParse(capacityController.text.trim()) ?? 1,
    );
  }

  Future<_TemplateFormResult?> _showTemplateDialog({Map<String, dynamic>? existing}) async {
    final Map<String, dynamic> template = existing ?? <String, dynamic>{};
    final TextEditingController nameController = TextEditingController(text: readString(template, const <String>['templateName'], fallback: ''));
    final TextEditingController serviceController = TextEditingController(text: readString(template, const <String>['service'], fallback: ''));
    final TextEditingController locationController = TextEditingController(text: readString(template, const <String>['location'], fallback: ''));
    final TextEditingController durationController = TextEditingController(text: '${readInt(template, const <String>['durationMinutes'], fallback: 30)}');
    final TextEditingController bufferController = TextEditingController(text: '${readInt(template, const <String>['bufferMinutes'], fallback: 10)}');
    final TextEditingController capacityController = TextEditingController(text: '${readInt(template, const <String>['capacity'], fallback: 1)}');
    final TextEditingController patternController = TextEditingController(text: _patternLabel(template['pattern']));
    final List<String> existingModes = _serviceModes(template['serviceModes']);
    bool inPerson = existingModes.contains('IN_PERSON');
    bool telehealth = existingModes.contains('TELEHEALTH');

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(existing == null ? 'Create schedule template' : 'Edit schedule template'),
        content: StatefulBuilder(
          builder: (BuildContext context, StateSetter setLocalState) {
            return SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Template name')),
                  const SizedBox(height: 12),
                  TextField(controller: serviceController, decoration: const InputDecoration(labelText: 'Service')),
                  const SizedBox(height: 12),
                  TextField(controller: locationController, decoration: const InputDecoration(labelText: 'Location')),
                  const SizedBox(height: 12),
                  TextField(controller: durationController, decoration: const InputDecoration(labelText: 'Duration minutes'), keyboardType: TextInputType.number),
                  const SizedBox(height: 12),
                  TextField(controller: bufferController, decoration: const InputDecoration(labelText: 'Buffer minutes'), keyboardType: TextInputType.number),
                  const SizedBox(height: 12),
                  TextField(controller: capacityController, decoration: const InputDecoration(labelText: 'Capacity'), keyboardType: TextInputType.number),
                  const SizedBox(height: 12),
                  TextField(controller: patternController, decoration: const InputDecoration(labelText: 'Pattern (Mon 09:00-12:00; Wed 13:00-16:00)')),
                  const SizedBox(height: 12),
                  CheckboxListTile(
                    value: inPerson,
                    onChanged: (bool? value) => setLocalState(() => inPerson = value ?? false),
                    title: const Text('In-person'),
                    contentPadding: EdgeInsets.zero,
                  ),
                  CheckboxListTile(
                    value: telehealth,
                    onChanged: (bool? value) => setLocalState(() => telehealth = value ?? false),
                    title: const Text('Telehealth'),
                    contentPadding: EdgeInsets.zero,
                  ),
                ],
              ),
            );
          },
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Save')),
        ],
      ),
    );
    if (confirmed != true) return null;
    return _TemplateFormResult(
      templateName: nameController.text.trim(),
      service: serviceController.text.trim(),
      location: locationController.text.trim(),
      durationMinutes: int.tryParse(durationController.text.trim()) ?? 30,
      bufferMinutes: int.tryParse(bufferController.text.trim()) ?? 10,
      capacity: int.tryParse(capacityController.text.trim()) ?? 1,
      patternText: patternController.text.trim(),
      serviceModes: <String>[if (inPerson) 'IN_PERSON', if (telehealth) 'TELEHEALTH'],
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final List<Map<String, dynamic>> templates = pickList(snapshot.data?['templates'], const <String>['items', 'templates']);
        final List<Map<String, dynamic>> slots = pickList(snapshot.data?['slots'], const <String>['items', 'slots']);
        final List<Map<String, dynamic>> availability = pickList(snapshot.data?['availability'], const <String>['items']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Schedule manager',
                  subtitle: 'Create published capacity, edit recurring templates, and push new schedule inventory from mobile.',
                  badge: 'Scheduling',
                  trailing: Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: <Widget>[
                      OutlinedButton.icon(
                        onPressed: _busy ? null : () => _editTemplate(null),
                        icon: const Icon(Icons.view_week_outlined),
                        label: const Text('New template'),
                      ),
                      FilledButton.icon(
                        onPressed: _busy ? null : _createSlot,
                        icon: const Icon(Icons.add_circle_outline_rounded),
                        label: const Text('New slot'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
                  children: <Widget>[
                    MetricCard(label: 'Templates', value: '${templates.length}'),
                    MetricCard(label: 'Published slots', value: '${slots.length}', variant: MetricVariant.success),
                    MetricCard(label: 'Available slots', value: '${availability.length}'),
                    MetricCard(label: 'Busy state', value: _busy ? 'Working' : 'Ready', variant: _busy ? MetricVariant.warning : MetricVariant.primary),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Templates'),
                const SizedBox(height: 12),
                if (templates.isEmpty)
                  const EmptyStateCard(title: 'No templates found', subtitle: 'Recurring availability templates will appear here.', icon: Icons.view_week_outlined)
                else
                  ...templates.map((Map<String, dynamic> item) {
                    final String id = readString(item, const <String>['id'], fallback: '');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(child: Text(readString(item, const <String>['templateName'], fallback: 'Template'), style: Theme.of(context).textTheme.titleMedium)),
                                StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text('${readString(item, const <String>['service'], fallback: 'Service')} • ${readString(item, const <String>['location'], fallback: 'Location')}'),
                            const SizedBox(height: 6),
                            Text(_patternLabel(item['pattern'])),
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: <Widget>[
                                OutlinedButton(onPressed: _busy ? null : () => _editTemplate(item), child: const Text('Edit')),
                                FilledButton(
                                  onPressed: _busy || id.isEmpty || id == '—' ? null : () => _publishTemplate(id),
                                  child: const Text('Publish'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Published slots'),
                const SizedBox(height: 12),
                if (slots.isEmpty)
                  const EmptyStateCard(title: 'No published slots', subtitle: 'Manual and published schedule capacity will appear here.', icon: Icons.schedule_send_outlined)
                else
                  ...slots.take(12).map((Map<String, dynamic> item) {
                    final String slotId = readString(item, const <String>['id'], fallback: '');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const CircleAvatar(child: Icon(Icons.schedule_rounded)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(readString(item, const <String>['service'], fallback: 'Slot'), style: Theme.of(context).textTheme.titleMedium),
                                  const SizedBox(height: 4),
                                  Text(formatDateTimeLabel(item['startsAt'])),
                                  const SizedBox(height: 4),
                                  Text('${readString(item, const <String>['location'], fallback: 'Location')} • Capacity ${readInt(item, const <String>['capacity'], fallback: 1)}'),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: <Widget>[
                                StatusBadge(readString(item, const <String>['statusLabel', 'status'], fallback: 'Published')),
                                const SizedBox(height: 10),
                                TextButton(
                                  onPressed: _busy || slotId.isEmpty || slotId == '—' ? null : () => _cancelSlot(slotId),
                                  child: const Text('Cancel'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SlotFormResult {
  const _SlotFormResult({
    required this.service,
    required this.location,
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
  });

  final String service;
  final String location;
  final String startsAt;
  final String endsAt;
  final int capacity;

  Map<String, dynamic> toPayload() => <String, dynamic>{
        'service': service,
        'location': location,
        'startsAt': startsAt,
        'endsAt': endsAt,
        'capacity': capacity,
      };
}

class _TemplateFormResult {
  const _TemplateFormResult({
    required this.templateName,
    required this.service,
    required this.location,
    required this.durationMinutes,
    required this.bufferMinutes,
    required this.capacity,
    required this.patternText,
    required this.serviceModes,
  });

  final String templateName;
  final String service;
  final String location;
  final int durationMinutes;
  final int bufferMinutes;
  final int capacity;
  final String patternText;
  final List<String> serviceModes;

  Map<String, dynamic> toPayload() => <String, dynamic>{
        'templateName': templateName,
        'service': service,
        'location': location,
        'durationMinutes': durationMinutes,
        'bufferMinutes': bufferMinutes,
        'capacity': capacity,
        'serviceModes': serviceModes,
        'pattern': _parsePattern(patternText),
      };
}

String _patternLabel(dynamic value) {
  if (value is! List || value.isEmpty) return 'No recurrence pattern configured';
  return value.map((dynamic item) {
    final Map<String, dynamic> map = asMap(item);
    return '${readString(map, const <String>['day'], fallback: 'Day')} ${readString(map, const <String>['hours'], fallback: '')}'.trim();
  }).join(' • ');
}

List<Map<String, dynamic>> _parsePattern(String text) {
  if (text.trim().isEmpty) return <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
  for (final String segment in text.split(';')) {
    final List<String> parts = segment.trim().split(RegExp(r'\s+', multiLine: false));
    if (parts.length >= 2) {
      items.add(<String, dynamic>{
        'day': parts.first,
        'hours': parts.sublist(1).join(' '),
      });
    }
  }
  return items;
}

List<String> _serviceModes(dynamic value) {
  if (value is! List) return <String>[];
  return value.map((dynamic item) => item.toString()).where((String item) => item.trim().isNotEmpty).toList();
}
