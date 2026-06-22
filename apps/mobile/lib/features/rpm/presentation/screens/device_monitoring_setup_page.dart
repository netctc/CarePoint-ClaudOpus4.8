import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/patient_ui.dart';

class DeviceMonitoringSetupPage extends StatefulWidget {
  const DeviceMonitoringSetupPage({super.key});

  @override
  State<DeviceMonitoringSetupPage> createState() => _DeviceMonitoringSetupPageState();
}

class _DeviceMonitoringSetupPageState extends State<DeviceMonitoringSetupPage> {
  late Future<_RpmSetupData> _future;
  bool _bluetoothGranted = true;
  bool _notificationGranted = true;
  bool _consentGranted = true;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_RpmSetupData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientRpmSummary(),
      AppSession.instance.patientRpmProgram(),
    ]);
    return _RpmSetupData(
      summary: (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{},
      program: (((responses[1] as Map<String, dynamic>)['item']) as Map?)?.cast<String, dynamic>(),
    );
  }

  Future<void> _refresh() async {
    final Future<_RpmSetupData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      title: 'Device setup',
      subtitle: 'Pair devices and confirm remote monitoring readiness',
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<_RpmSetupData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_RpmSetupData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) return Padding(padding: const EdgeInsets.all(24), child: PatientEmptyState(title: 'Unable to load RPM setup', body: snapshot.error.toString(), icon: Icons.monitor_heart_outlined, action: FilledButton.tonal(onPressed: _refresh, child: const Text('Retry'))));
          final _RpmSetupData data = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(badge: '${data.summary['recentReadingCount'] ?? 0} readings', title: data.program?['title']?.toString() ?? 'Remote monitoring program', subtitle: data.program?['description']?.toString() ?? 'Pair a device or log readings manually to keep your care team updated.'),
              const SizedBox(height: 18),
              PatientCard(child: Column(children: <Widget>[
                SwitchListTile.adaptive(contentPadding: EdgeInsets.zero, value: _bluetoothGranted, onChanged: (bool value) => setState(() => _bluetoothGranted = value), title: const Text('Bluetooth access')),
                const Divider(),
                SwitchListTile.adaptive(contentPadding: EdgeInsets.zero, value: _notificationGranted, onChanged: (bool value) => setState(() => _notificationGranted = value), title: const Text('Notifications enabled')),
                const Divider(),
                SwitchListTile.adaptive(contentPadding: EdgeInsets.zero, value: _consentGranted, onChanged: (bool value) => setState(() => _consentGranted = value), title: const Text('RPM consent active')),
              ])),
            ],
          );
        },
      ),
      bottomAction: SafeArea(
        top: false,
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: FilledButton.icon(onPressed: (_bluetoothGranted && _notificationGranted && _consentGranted) ? () => context.go('/rpm/trends') : null, icon: const Icon(Icons.monitor_heart_outlined), label: const Text('Continue to trends')),
      ),
    );
  }
}

class _RpmSetupData {
  const _RpmSetupData({required this.summary, this.program});
  final Map<String, dynamic> summary;
  final Map<String, dynamic>? program;
}
