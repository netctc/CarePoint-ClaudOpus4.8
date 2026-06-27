import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

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
  // Form visibility
  bool _showTemplateForm = false;
  bool _showSlotForm = false;
  Map<String, dynamic>? _editingTemplate;

  // Template form controllers
  final TextEditingController _tNameCtrl = TextEditingController();
  final TextEditingController _tServiceCtrl = TextEditingController();
  final TextEditingController _tLocationCtrl = TextEditingController();
  final TextEditingController _tDurationCtrl = TextEditingController(text: '30');
  final TextEditingController _tBufferCtrl = TextEditingController(text: '10');
  final TextEditingController _tCapacityCtrl = TextEditingController(text: '1');
  final TextEditingController _tPatternCtrl = TextEditingController();
  bool _modeOnline = true;
  bool _modeInPerson = true;
  bool _modeHomeVisit = false;

  // Slot form controllers
  final TextEditingController _sServiceCtrl = TextEditingController(text: 'Follow-up consultation');
  String _sLocation = 'Main Clinic';
  DateTime _sStartDate = DateTime.now().add(const Duration(hours: 2));
  TimeOfDay _sStartTime = TimeOfDay.now();
  DateTime _sEndDate = DateTime.now().add(const Duration(hours: 2, minutes: 30));
  TimeOfDay _sEndTime = TimeOfDay(hour: TimeOfDay.now().hour, minute: TimeOfDay.now().minute + 30);
  final TextEditingController _sCapacityCtrl = TextEditingController(text: '1');

  static const List<String> _locations = <String>['Main Clinic', 'Branch North', 'Branch South', 'Virtual', 'Home Visit'];

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _tNameCtrl.dispose();
    _tServiceCtrl.dispose();
    _tLocationCtrl.dispose();
    _tDurationCtrl.dispose();
    _tBufferCtrl.dispose();
    _tCapacityCtrl.dispose();
    _tPatternCtrl.dispose();
    _sServiceCtrl.dispose();
    _sCapacityCtrl.dispose();
    super.dispose();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'templates': await api.calendarTemplates(),
      'slots': await api.calendarPublishedSlots(days: 14),
      'availability': await api.calendarAvailability(days: 14),
    };
  }

  void _refresh() => setState(() => _future = _load());

  void _openTemplateForm({Map<String, dynamic>? existing}) {
    _editingTemplate = existing;
    if (existing != null) {
      _tNameCtrl.text = readString(existing, const <String>['templateName'], fallback: '');
      _tServiceCtrl.text = readString(existing, const <String>['service'], fallback: '');
      _tLocationCtrl.text = readString(existing, const <String>['location'], fallback: '');
      _tDurationCtrl.text = '${readInt(existing, const <String>['durationMinutes'], fallback: 30)}';
      _tBufferCtrl.text = '${readInt(existing, const <String>['bufferMinutes'], fallback: 10)}';
      _tCapacityCtrl.text = '${readInt(existing, const <String>['capacity'], fallback: 1)}';
      _tPatternCtrl.text = _patternLabel(existing['pattern']);
      final List<String> modes = _serviceModes(existing['serviceModes']);
      _modeOnline = modes.contains('TELEHEALTH') || modes.contains('ONLINE');
      _modeInPerson = modes.contains('IN_PERSON');
      _modeHomeVisit = modes.contains('HOME_VISIT');
    } else {
      _tNameCtrl.clear();
      _tServiceCtrl.clear();
      _tLocationCtrl.clear();
      _tDurationCtrl.text = '30';
      _tBufferCtrl.text = '10';
      _tCapacityCtrl.text = '1';
      _tPatternCtrl.clear();
      _modeOnline = true;
      _modeInPerson = true;
      _modeHomeVisit = false;
    }
    setState(() {
      _showTemplateForm = true;
      _showSlotForm = false;
    });
  }

  void _openSlotForm() {
    setState(() {
      _showSlotForm = true;
      _showTemplateForm = false;
    });
  }

  Future<void> _submitTemplate() async {
    setState(() => _busy = true);
    try {
      final Map<String, dynamic> payload = <String, dynamic>{
        'templateName': _tNameCtrl.text.trim(),
        'service': _tServiceCtrl.text.trim(),
        'location': _tLocationCtrl.text.trim(),
        'durationMinutes': int.tryParse(_tDurationCtrl.text.trim()) ?? 30,
        'bufferMinutes': int.tryParse(_tBufferCtrl.text.trim()) ?? 10,
        'capacity': int.tryParse(_tCapacityCtrl.text.trim()) ?? 1,
        'serviceModes': <String>[if (_modeOnline) 'TELEHEALTH', if (_modeInPerson) 'IN_PERSON', if (_modeHomeVisit) 'HOME_VISIT'],
        'pattern': _parsePattern(_tPatternCtrl.text.trim()),
      };
      final String existingId = readString(_editingTemplate, const <String>['id'], fallback: '');
      if (existingId.isEmpty || existingId == '—') {
        await ProviderSession.instance.api.createCalendarTemplate(payload);
      } else {
        await ProviderSession.instance.api.updateCalendarTemplate(existingId, payload);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template saved.')));
      setState(() => _showTemplateForm = false);
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _submitSlot() async {
    final DateTime start = DateTime(_sStartDate.year, _sStartDate.month, _sStartDate.day, _sStartTime.hour, _sStartTime.minute);
    final DateTime end = DateTime(_sEndDate.year, _sEndDate.month, _sEndDate.day, _sEndTime.hour, _sEndTime.minute);
    setState(() => _busy = true);
    try {
      await ProviderSession.instance.api.createPublishedSlot(<String, dynamic>{
        'service': _sServiceCtrl.text.trim(),
        'location': _sLocation,
        'startsAt': start.toIso8601String(),
        'endsAt': end.toIso8601String(),
        'capacity': int.tryParse(_sCapacityCtrl.text.trim()) ?? 1,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Slot created.')));
      setState(() => _showSlotForm = false);
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
      await ProviderSession.instance.api.publishCalendarTemplate(templateId, note: 'Published from mobile.');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Template published.')));
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
      await ProviderSession.instance.api.cancelPublishedSlot(slotId, note: 'Cancelled from mobile.');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Slot cancelled.')));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickStartDate() async {
    final DateTime? d = await showDatePicker(context: context, initialDate: _sStartDate, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)));
    if (d != null) setState(() => _sStartDate = d);
  }

  Future<void> _pickStartTime() async {
    final TimeOfDay? t = await showTimePicker(context: context, initialTime: _sStartTime);
    if (t != null) setState(() => _sStartTime = t);
  }

  Future<void> _pickEndDate() async {
    final DateTime? d = await showDatePicker(context: context, initialDate: _sEndDate, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)));
    if (d != null) setState(() => _sEndDate = d);
  }

  Future<void> _pickEndTime() async {
    final TimeOfDay? t = await showTimePicker(context: context, initialTime: _sEndTime);
    if (t != null) setState(() => _sEndTime = t);
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: <Widget>[
                // Compact header with actions
                Row(
                  children: <Widget>[
                    Expanded(child: Text('Schedule Manager', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700))),
                    IconButton.filledTonal(onPressed: _refresh, icon: const Icon(Icons.refresh_rounded, size: 20)),
                  ],
                ),
                const SizedBox(height: 12),

                // Compact metric cards (4 in grid, smaller)
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 4,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 0.9,
                  children: <Widget>[
                    _MiniMetric(label: 'Templates', value: '${templates.length}', icon: Icons.view_week_outlined),
                    _MiniMetric(label: 'Published', value: '${slots.length}', icon: Icons.schedule_send_outlined, color: const Color(0xFF16A34A)),
                    _MiniMetric(label: 'Available', value: '${availability.length}', icon: Icons.event_available_rounded, color: const Color(0xFF1565C0)),
                    _MiniMetric(label: _busy ? 'Working' : 'Ready', value: '', icon: Icons.circle, color: _busy ? const Color(0xFFF59E0B) : const Color(0xFF16A34A)),
                  ],
                ),
                const SizedBox(height: 12),

                // Action buttons
                Row(
                  children: <Widget>[
                    Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _openTemplateForm(), icon: const Icon(Icons.add, size: 18), label: const Text('New template'))),
                    const SizedBox(width: 8),
                    Expanded(child: FilledButton.icon(onPressed: _busy ? null : _openSlotForm, icon: const Icon(Icons.add, size: 18), label: const Text('New slot'))),
                  ],
                ),

                // Template form (inline, shown below buttons)
                if (_showTemplateForm) ...<Widget>[
                  const SizedBox(height: 16),
                  _buildTemplateForm(),
                ],

                // Slot form (inline)
                if (_showSlotForm) ...<Widget>[
                  const SizedBox(height: 16),
                  _buildSlotForm(),
                ],

                // Templates list
                const SizedBox(height: 16),
                const SectionTitle(title: 'Templates'),
                const SizedBox(height: 8),
                if (templates.isEmpty)
                  const EmptyStateCard(title: 'No templates', subtitle: 'Create one above.', icon: Icons.view_week_outlined)
                else
                  ...templates.map((item) {
                    final String id = readString(item, const <String>['id'], fallback: '');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: InkWell(
                        onTap: () => _openTemplateForm(existing: item),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.shade200),
                          ),
                          child: Row(
                            children: <Widget>[
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(item, const <String>['templateName'], fallback: 'Template'), style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                                    Text('${readString(item, const <String>['service'], fallback: '')} • ${readString(item, const <String>['location'], fallback: '')}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600])),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                              if (id.isNotEmpty && id != '—')
                                IconButton(icon: const Icon(Icons.publish_rounded, size: 20), onPressed: _busy ? null : () => _publishTemplate(id), tooltip: 'Publish'),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),

                // Published slots
                const SizedBox(height: 16),
                const SectionTitle(title: 'Published slots'),
                const SizedBox(height: 8),
                if (slots.isEmpty)
                  const EmptyStateCard(title: 'No slots', subtitle: 'Create or publish a template.', icon: Icons.schedule_send_outlined)
                else
                  ...slots.take(10).map((item) {
                    final String slotId = readString(item, const <String>['id'], fallback: '');
                    final String startsAt = formatDateTimeLabel(item['startsAt']);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          children: <Widget>[
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(startsAt, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                                  Text('${readString(item, const <String>['service'], fallback: '')} • ${readString(item, const <String>['location'], fallback: '')}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600])),
                                ],
                              ),
                            ),
                            StatusBadge(readString(item, const <String>['statusLabel', 'status'], fallback: 'Published')),
                            if (slotId.isNotEmpty && slotId != '—')
                              IconButton(icon: const Icon(Icons.cancel_outlined, size: 18, color: Colors.red), onPressed: _busy ? null : () => _cancelSlot(slotId), tooltip: 'Cancel'),
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

  Widget _buildTemplateForm() {
    return ProviderCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text(_editingTemplate != null ? 'Edit template' : 'New template', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
              IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => setState(() => _showTemplateForm = false)),
            ],
          ),
          const SizedBox(height: 12),
          TextField(controller: _tNameCtrl, decoration: const InputDecoration(labelText: 'Template name', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _tServiceCtrl, decoration: const InputDecoration(labelText: 'Service', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          TextField(controller: _tLocationCtrl, decoration: const InputDecoration(labelText: 'Location', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              Expanded(child: TextField(controller: _tDurationCtrl, decoration: const InputDecoration(labelText: 'Duration (min)', border: OutlineInputBorder()), keyboardType: TextInputType.number)),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: _tBufferCtrl, decoration: const InputDecoration(labelText: 'Buffer (min)', border: OutlineInputBorder()), keyboardType: TextInputType.number)),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: _tCapacityCtrl, decoration: const InputDecoration(labelText: 'Capacity', border: OutlineInputBorder()), keyboardType: TextInputType.number)),
            ],
          ),
          const SizedBox(height: 10),
          TextField(controller: _tPatternCtrl, decoration: const InputDecoration(labelText: 'Pattern (Mon 09:00-12:00; Wed 13:00-16:00)', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          Text('Service mode', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
          Wrap(
            spacing: 8,
            children: <Widget>[
              FilterChip(label: const Text('Online'), selected: _modeOnline, onSelected: (v) => setState(() => _modeOnline = v)),
              FilterChip(label: const Text('In-Person'), selected: _modeInPerson, onSelected: (v) => setState(() => _modeInPerson = v)),
              FilterChip(label: const Text('Home-Visit'), selected: _modeHomeVisit, onSelected: (v) => setState(() => _modeHomeVisit = v)),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : _submitTemplate, child: Text(_busy ? 'Saving...' : 'Save template'))),
        ],
      ),
    );
  }

  Widget _buildSlotForm() {
    return ProviderCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(child: Text('New slot', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700))),
              IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => setState(() => _showSlotForm = false)),
            ],
          ),
          const SizedBox(height: 12),
          TextField(controller: _sServiceCtrl, decoration: const InputDecoration(labelText: 'Service', border: OutlineInputBorder())),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: _sLocation,
            decoration: const InputDecoration(labelText: 'Location', border: OutlineInputBorder()),
            items: _locations.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
            onChanged: (v) => setState(() => _sLocation = v ?? _sLocation),
          ),
          const SizedBox(height: 10),
          // Start date + time
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickStartDate,
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: Text(DateFormat('dd/MM/yyyy').format(_sStartDate), style: const TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickStartTime,
                  icon: const Icon(Icons.access_time, size: 16),
                  label: Text(_sStartTime.format(context), style: const TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // End date + time
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickEndDate,
                  icon: const Icon(Icons.calendar_today, size: 16),
                  label: Text(DateFormat('dd/MM/yyyy').format(_sEndDate), style: const TextStyle(fontSize: 13)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickEndTime,
                  icon: const Icon(Icons.access_time, size: 16),
                  label: Text(_sEndTime.format(context), style: const TextStyle(fontSize: 13)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(controller: _sCapacityCtrl, decoration: const InputDecoration(labelText: 'Capacity', border: OutlineInputBorder()), keyboardType: TextInputType.number),
          const SizedBox(height: 14),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : _submitSlot, child: Text(_busy ? 'Creating...' : 'Create slot'))),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value, required this.icon, this.color});
  final String label;
  final String value;
  final IconData icon;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final Color c = color ?? Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: c.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.withOpacity(0.15)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Icon(icon, color: c, size: 20),
          if (value.isNotEmpty) Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: c)),
          Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 10), textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

String _patternLabel(dynamic value) {
  if (value is! List || value.isEmpty) return '';
  return value.map((dynamic item) {
    final Map<String, dynamic> map = asMap(item);
    return '${readString(map, const <String>['day'], fallback: '')} ${readString(map, const <String>['hours'], fallback: '')}'.trim();
  }).join(' • ');
}

List<Map<String, dynamic>> _parsePattern(String text) {
  if (text.trim().isEmpty) return <Map<String, dynamic>>[];
  final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
  for (final String segment in text.split(';')) {
    final List<String> parts = segment.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      items.add(<String, dynamic>{'day': parts.first, 'hours': parts.sublist(1).join(' ')});
    }
  }
  return items;
}

List<String> _serviceModes(dynamic value) {
  if (value is! List) return <String>[];
  return value.map((dynamic item) => item.toString()).where((item) => item.trim().isNotEmpty).toList();
}
