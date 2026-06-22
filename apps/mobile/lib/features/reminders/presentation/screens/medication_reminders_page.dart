import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class MedicationRemindersPage extends StatefulWidget {
  const MedicationRemindersPage({super.key});

  @override
  State<MedicationRemindersPage> createState() => _MedicationRemindersPageState();
}

class _MedicationRemindersPageState extends State<MedicationRemindersPage> {
  late Future<_ReminderData> _future;
  late String _subjectKey;
  _ReminderData _currentData = const _ReminderData(summary: <String, dynamic>{}, reminders: <Map<String, dynamic>>[]);

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
    final Future<_ReminderData> refreshed = _load();
    if (mounted) {
      setState(() { _future = refreshed; });
    }
  }

  Future<_ReminderData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientReminderSummary(),
      AppSession.instance.patientReminders(),
    ]);
    return _ReminderData(
      summary: (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{},
      reminders: (((responses[1] as Map<String, dynamic>)['items']) as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList(),
    );
  }

  Future<void> _refresh() async {
    _subjectKey = _currentSubjectKey;
    final Future<_ReminderData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _applySavedReminder(Map<String, dynamic> item) async {
    final String itemId = item['id']?.toString() ?? '';
    final List<Map<String, dynamic>> next = <Map<String, dynamic>>[
      for (final Map<String, dynamic> reminder in _currentData.reminders)
        if (reminder['id']?.toString() != itemId) reminder,
      item,
    ];
    next.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      final String first = a['medication']?.toString() ?? '';
      final String second = b['medication']?.toString() ?? '';
      return first.compareTo(second);
    });
    final Map<String, dynamic> summary = <String, dynamic>{
      ..._currentData.summary,
      'total': next.length,
      'enabledCount': next.where((Map<String, dynamic> reminder) => reminder['enabled'] == true).length,
    };
    if (mounted) {
      setState(() {
        _currentData = _ReminderData(summary: summary, reminders: next);
        _future = Future<_ReminderData>.value(_currentData);
      });
    }
  }

  Future<void> _toggle(String id) async {
    final Map<String, dynamic> response = await AppSession.instance.toggleReminder(id);
    final Map<String, dynamic>? item = (response['item'] as Map?)?.cast<String, dynamic>();
    if (item != null) await _applySavedReminder(item);
    unawaited(_refresh());
  }

  Future<void> _logDose(String id, String outcome) async {
    await AppSession.instance.logReminderDose(id, outcome: outcome);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(outcome == 'TAKEN' ? 'Dose marked as taken.' : 'Dose marked as skipped.')));
    await _refresh();
  }

  Future<void> _deleteReminder(Map<String, dynamic> reminder) async {
    final bool confirmed = await showDialog<bool>(
          context: context,
          builder: (BuildContext context) => AlertDialog(
            title: const Text('Delete reminder'),
            content: Text('Remove ${reminder['medication'] ?? 'this reminder'} from the active profile?'),
            actions: <Widget>[
              TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    await AppSession.instance.deleteReminder(reminder['id']?.toString() ?? '');
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Reminder deleted.')));
    await _refresh();
  }

  Future<void> _openEditor([Map<String, dynamic>? current]) async {
    final TextEditingController medicationController = TextEditingController(text: current?['medication']?.toString() ?? '');
    bool enabled = current?['enabled'] == false ? false : true;
    String scheduleMode = (current?['schedule']?.toString() ?? '').toLowerCase().contains('every ') ? 'interval' : 'time';
    TimeOfDay selectedTime = _parseTimeOfDay(current?['schedule']?.toString()) ?? const TimeOfDay(hour: 8, minute: 0);
    int intervalHours = _parseIntervalHours(current?['schedule']?.toString()) ?? 8;

    final bool? saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) {
        return Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
          child: StatefulBuilder(
            builder: (BuildContext context, void Function(void Function()) setModalState) {
              final String schedulePreview = _formatReminderSchedule(scheduleMode: scheduleMode, selectedTime: selectedTime, intervalHours: intervalHours);
              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(current == null ? 'Add medication reminder' : 'Edit medication reminder', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 16),
                    TextField(controller: medicationController, decoration: const InputDecoration(labelText: 'Medication')),
                    const SizedBox(height: 16),
                    Text('Schedule type', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    SegmentedButton<String>(
                      segments: const <ButtonSegment<String>>[
                        ButtonSegment<String>(value: 'time', label: Text('By hour'), icon: Icon(Icons.schedule_outlined)),
                        ButtonSegment<String>(value: 'interval', label: Text('Interval'), icon: Icon(Icons.repeat_outlined)),
                      ],
                      selected: <String>{scheduleMode},
                      onSelectionChanged: (Set<String> value) => setModalState(() => scheduleMode = value.first),
                    ),
                    const SizedBox(height: 14),
                    if (scheduleMode == 'time')
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.access_time_outlined),
                        title: const Text('Reminder hour'),
                        subtitle: Text(selectedTime.format(context)),
                        trailing: const Icon(Icons.edit_outlined),
                        onTap: () async {
                          final TimeOfDay? picked = await showTimePicker(context: context, initialTime: selectedTime);
                          if (picked != null) setModalState(() => selectedTime = picked);
                        },
                      )
                    else
                      DropdownButtonFormField<int>(
                        initialValue: intervalHours,
                        decoration: const InputDecoration(labelText: 'Repeat every'),
                        items: const <int>[2, 4, 6, 8, 12]
                            .map((int value) => DropdownMenuItem<int>(value: value, child: Text('$value hours')))
                            .toList(),
                        onChanged: (int? value) => setModalState(() => intervalHours = value ?? 8),
                      ),
                    const SizedBox(height: 12),
                    PatientTintedCard(
                      tint: const Color(0xFFF5F9FF),
                      child: Row(
                        children: <Widget>[
                          const Icon(Icons.notifications_active_outlined),
                          const SizedBox(width: 10),
                          Expanded(child: Text('Schedule preview: $schedulePreview')),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      value: enabled,
                      title: const Text('Enabled'),
                      subtitle: const Text('Turn daily notifications on or off'),
                      onChanged: (bool value) => setModalState(() => enabled = value),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel'))),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () {
                              if (medicationController.text.trim().isEmpty) return;
                              Navigator.of(context).pop(true);
                            },
                            child: const Text('Save'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );

    if (saved == true) {
      final String schedule = _formatReminderSchedule(scheduleMode: scheduleMode, selectedTime: selectedTime, intervalHours: intervalHours);
      final Map<String, dynamic> response = await AppSession.instance.saveReminder(
        id: current?['id']?.toString(),
        medication: medicationController.text.trim(),
        schedule: schedule,
        enabled: enabled,
      );
      final Map<String, dynamic>? item = (response['item'] as Map?)?.cast<String, dynamic>();
      if (item != null) await _applySavedReminder(item);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(current == null ? 'Reminder added.' : 'Reminder updated.')));
      unawaited(_refresh());
    }

    medicationController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Medication reminders',
      subtitle: 'Schedules, hourly reminders, and adherence tracking',
      showBack: true,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Add reminder'),
      ),
      child: FutureBuilder<_ReminderData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_ReminderData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: PatientEmptyState(title: 'Unable to load reminders', body: snapshot.error.toString(), icon: Icons.alarm_off_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))));
          final _ReminderData data = snapshot.data!;
          _currentData = data;
          final int enabledCount = (data.summary['enabledCount'] as num?)?.toInt() ?? data.reminders.where((Map<String, dynamic> item) => item['enabled'] == true).length;
          final int adherenceRate = (data.summary['adherenceRate7d'] as num?)?.toInt() ?? 0;
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: '${data.reminders.length} reminders', title: 'Never miss the next dose', subtitle: 'Create reminders by exact hour or repeat them at defined hourly intervals.'),
              const SizedBox(height: 18),
              Row(children: <Widget>[
                Expanded(child: PatientMetricCard(label: 'Enabled', value: '$enabledCount', caption: 'Reminders turned on', icon: Icons.notifications_active_outlined)),
                const SizedBox(width: 12),
                Expanded(child: PatientMetricCard(label: '7-day adherence', value: data.summary['adherenceRate7d'] == null ? '--' : '$adherenceRate%', caption: '${data.summary['takenCount7d'] ?? 0}/${data.summary['totalLogged7d'] ?? 0} logged', icon: Icons.checklist_outlined)),
              ]),
              const SizedBox(height: 18),
              if (data.reminders.isEmpty)
                PatientEmptyState(
                  title: 'No medication reminders yet',
                  body: 'Create the first reminder for the active profile member.',
                  icon: Icons.alarm_add_outlined,
                  action: FilledButton(onPressed: () => _openEditor(), child: const Text('Add reminder')),
                )
              else
                ...data.reminders.map((Map<String, dynamic> reminder) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: PatientCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            SwitchListTile.adaptive(
                              contentPadding: EdgeInsets.zero,
                              value: reminder['enabled'] == true,
                              onChanged: (_) => _toggle(reminder['id']?.toString() ?? ''),
                              title: Text(reminder['medication']?.toString() ?? 'Medication', style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                              subtitle: Text(reminder['schedule']?.toString() ?? 'Daily schedule'),
                            ),
                            if ((reminder['lastLog'] as Map?) != null) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(
                                _lastLogLabel((reminder['lastLog'] as Map).cast<String, dynamic>()),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                            const SizedBox(height: 12),
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: <Widget>[
                                FilledButton.tonalIcon(
                                  onPressed: reminder['enabled'] == true ? () => _logDose(reminder['id']?.toString() ?? '', 'TAKEN') : null,
                                  icon: const Icon(Icons.check_circle_outline),
                                  label: const Text('Taken'),
                                ),
                                FilledButton.tonalIcon(
                                  onPressed: reminder['enabled'] == true ? () => _logDose(reminder['id']?.toString() ?? '', 'SKIPPED') : null,
                                  icon: const Icon(Icons.cancel_outlined),
                                  label: const Text('Skipped'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: () => _openEditor(reminder),
                                  icon: const Icon(Icons.edit_outlined),
                                  label: const Text('Edit'),
                                ),
                                OutlinedButton.icon(
                                  onPressed: () => _deleteReminder(reminder),
                                  icon: const Icon(Icons.delete_outline),
                                  label: const Text('Delete'),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _adherenceLabel((reminder['adherenceSummary'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{}),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    )),
            ],
          );
        },
      ),
    );
  }
}

class _ReminderData {
  const _ReminderData({required this.summary, required this.reminders});
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> reminders;
}

String _formatReminderSchedule({required String scheduleMode, required TimeOfDay selectedTime, required int intervalHours}) {
  if (scheduleMode == 'interval') return 'Every $intervalHours hours';
  final int hour = selectedTime.hourOfPeriod == 0 ? 12 : selectedTime.hourOfPeriod;
  final String minute = selectedTime.minute.toString().padLeft(2, '0');
  final String period = selectedTime.period == DayPeriod.am ? 'AM' : 'PM';
  return 'Daily at $hour:$minute $period';
}

TimeOfDay? _parseTimeOfDay(String? schedule) {
  final RegExpMatch? match = RegExp(r'(\d{1,2}):(\d{2})\s*(AM|PM)', caseSensitive: false).firstMatch(schedule ?? '');
  if (match == null) return null;
  int hour = int.tryParse(match.group(1) ?? '') ?? 8;
  final int minute = int.tryParse(match.group(2) ?? '') ?? 0;
  final String period = (match.group(3) ?? 'AM').toUpperCase();
  if (period == 'PM' && hour < 12) hour += 12;
  if (period == 'AM' && hour == 12) hour = 0;
  return TimeOfDay(hour: hour.clamp(0, 23), minute: minute.clamp(0, 59));
}

int? _parseIntervalHours(String? schedule) {
  final RegExpMatch? match = RegExp(r'every\s+(\d+)\s+hours?', caseSensitive: false).firstMatch(schedule ?? '');
  return match == null ? null : int.tryParse(match.group(1) ?? '');
}

String _lastLogLabel(Map<String, dynamic> log) {
  final String outcome = log['outcome'] == 'TAKEN' ? 'Taken' : 'Skipped';
  final DateTime? occurredAt = DateTime.tryParse(log['occurredAt']?.toString() ?? '')?.toLocal();
  final String time = occurredAt == null ? 'recently' : DateFormat('EEE, d MMM • h:mm a').format(occurredAt);
  return 'Last action: $outcome • $time';
}

String _adherenceLabel(Map<String, dynamic> summary) {
  final int taken = (summary['takenCount7d'] as num?)?.toInt() ?? 0;
  final int skipped = (summary['skippedCount7d'] as num?)?.toInt() ?? 0;
  final int total = (summary['totalLogged7d'] as num?)?.toInt() ?? 0;
  if (total == 0) return 'No adherence activity logged in the last 7 days.';
  return 'Last 7 days: $taken taken • $skipped skipped • $total actions logged';
}
