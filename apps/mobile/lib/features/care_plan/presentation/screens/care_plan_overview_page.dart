import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class CarePlanOverviewPage extends StatefulWidget {
  const CarePlanOverviewPage({super.key});

  @override
  State<CarePlanOverviewPage> createState() => _CarePlanOverviewPageState();
}

class _CarePlanOverviewPageState extends State<CarePlanOverviewPage> {
  late Future<_CarePlanData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_CarePlanData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientCarePlanSummary(),
      AppSession.instance.patientCarePlanTasks(),
    ]);
    final Map<String, dynamic> summary = (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final List<Map<String, dynamic>> tasks = (((responses[1] as Map<String, dynamic>)['items']) as List<dynamic>? ?? <dynamic>[]).whereType<Map<String, dynamic>>().toList();
    final int completed = (summary['completedCount'] as num?)?.toInt() ?? tasks.where((Map<String, dynamic> task) => task['completed'] == true || '${task['status']}'.toUpperCase() == 'COMPLETED').length;
    return _CarePlanData(summary: summary, tasks: tasks, progress: tasks.isEmpty ? 0 : completed / tasks.length, completedCount: completed);
  }

  Future<void> _refresh() async {
    final Future<_CarePlanData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Care plan',
      subtitle: 'Goals, tasks, and day-to-day progress',
      showBack: true,
      currentIndex: 0,
      child: FutureBuilder<_CarePlanData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_CarePlanData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(title: 'Unable to load care plan', body: snapshot.error.toString(), icon: Icons.assignment_late_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))),
            );
          }
          final _CarePlanData data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
              children: <Widget>[
                PatientHeroCard(badge: '${data.tasks.length} tasks', title: data.summary['title']?.toString() ?? 'Your active care plan', subtitle: data.summary['description']?.toString() ?? 'Keep up with assigned activities, check-ins, and follow-up goals.'),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(child: PatientMetricCard(label: 'Completed', value: '${data.completedCount}', caption: 'Tasks finished', icon: Icons.check_circle_outline)),
                    const SizedBox(width: 12),
                    Expanded(child: PatientMetricCard(label: 'Remaining', value: '${data.tasks.length - data.completedCount}', caption: 'Tasks still open', icon: Icons.pending_actions_outlined)),
                  ],
                ),
                const SizedBox(height: 18),
                PatientCard(child: PatientProgressStrip(label: 'Overall progress', progress: data.progress, caption: data.progress >= 1 ? 'You are fully caught up with your current care plan.' : 'Complete the next task to keep your plan on track.')),
                const SizedBox(height: 18),
                const PatientSectionTitle(title: 'Tasks'),
                const SizedBox(height: 12),
                ...data.tasks.map((Map<String, dynamic> task) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: PatientActionTile(
                    title: task['title']?.toString() ?? 'Care plan task',
                    subtitle: task['description']?.toString() ?? task['status']?.toString() ?? 'Open the task for details and progress.',
                    icon: task['completed'] == true || '${task['status']}'.toUpperCase() == 'COMPLETED' ? Icons.check_circle_outline : Icons.assignment_outlined,
                    onTap: () => context.go('/care-plan/task?id=${task['id']}'),
                  ),
                )),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CarePlanData {
  const _CarePlanData({required this.summary, required this.tasks, required this.progress, required this.completedCount});

  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> tasks;
  final double progress;
  final int completedCount;
}
