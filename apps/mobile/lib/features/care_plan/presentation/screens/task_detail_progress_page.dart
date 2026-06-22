import 'package:flutter/material.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class TaskDetailProgressPage extends StatefulWidget {
  const TaskDetailProgressPage({super.key, this.taskId});

  final String? taskId;

  @override
  State<TaskDetailProgressPage> createState() => _TaskDetailProgressPageState();
}

class _TaskDetailProgressPageState extends State<TaskDetailProgressPage> {
  late Future<Map<String, dynamic>> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final String id = widget.taskId ?? '';
    if (id.isEmpty) throw Exception('Missing task identifier');
    final Map<String, dynamic> response = await AppSession.instance.patientCarePlanTask(id);
    return (response['item'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
  }

  Future<void> _refresh() async {
    final Future<Map<String, dynamic>> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _runAction(Future<Map<String, dynamic>> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      await _refresh();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Task detail',
      subtitle: 'Progress, guidance, and completion actions',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load task', body: snapshot.error.toString(), icon: Icons.assignment_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final Map<String, dynamic> task = snapshot.data ?? <String, dynamic>{};
          final bool completed = task['completed'] == true || '${task['status']}'.toUpperCase() == 'COMPLETED';
          final String taskId = (task['id'] ?? widget.taskId ?? '').toString();
          final List<dynamic> checklist = task['checklist'] as List<dynamic>? ?? <dynamic>[];
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: task['status']?.toString() ?? 'Open', title: task['title']?.toString() ?? 'Care plan task', subtitle: task['description']?.toString() ?? 'Complete this activity to move your plan forward.'),
              const SizedBox(height: 18),
              PatientCard(child: PatientProgressStrip(label: 'Task completion', progress: completed ? 1 : 0.45, caption: completed ? 'This task is already complete.' : 'Complete or snooze this task based on your care plan guidance.')),
              const SizedBox(height: 18),
              PatientCard(
                child: Column(
                  children: <Widget>[
                    PatientInfoRow(label: 'Owner', value: task['owner']?.toString() ?? 'CarePoint care team', icon: Icons.person_outline),
                    PatientInfoRow(label: 'Due date', value: task['dueAt']?.toString() ?? 'Follow care team schedule', icon: Icons.schedule_outlined),
                    PatientInfoRow(label: 'Priority', value: task['priority']?.toString() ?? 'Standard', icon: Icons.flag_outlined),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const PatientSectionTitle(title: 'Checklist'),
              const SizedBox(height: 12),
              PatientCard(
                child: checklist.isEmpty
                    ? const Text('No checklist was provided for this task.')
                    : Column(
                        children: checklist.map((dynamic item) {
                          final Map<String, dynamic> entry = item is Map ? item.cast<String, dynamic>() : <String, dynamic>{};
                          return CheckboxListTile(
                            value: entry['done'] == true,
                            onChanged: null,
                            contentPadding: EdgeInsets.zero,
                            title: Text(entry['label']?.toString() ?? 'Checklist item'),
                            controlAffinity: ListTileControlAffinity.leading,
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              Row(
                children: <Widget>[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _runAction(() => AppSession.instance.snoozeCarePlanTask(taskId), 'Task snoozed.'),
                      child: Text(_busy ? 'Please wait…' : 'Snooze'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy || completed ? null : () => _runAction(() => AppSession.instance.completeCarePlanTask(taskId), 'Task completed.'),
                      child: Text(completed ? 'Completed' : 'Complete task'),
                    ),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
