import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/widgets/provider_ui.dart';

class ProviderNotificationPreferencesPage extends StatefulWidget {
  const ProviderNotificationPreferencesPage({super.key});

  @override
  State<ProviderNotificationPreferencesPage> createState() => _ProviderNotificationPreferencesPageState();
}

class _ProviderNotificationPreferencesPageState extends State<ProviderNotificationPreferencesPage> {
  static const String _prefix = 'carepoint.provider.notifications.';
  bool _appointments = true;
  bool _messages = true;
  bool _alerts = true;
  bool _refills = true;
  bool _dailyDigest = false;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    setState(() {
      _appointments = preferences.getBool('${_prefix}appointments') ?? true;
      _messages = preferences.getBool('${_prefix}messages') ?? true;
      _alerts = preferences.getBool('${_prefix}alerts') ?? true;
      _refills = preferences.getBool('${_prefix}refills') ?? true;
      _dailyDigest = preferences.getBool('${_prefix}dailyDigest') ?? false;
    });
  }

  Future<void> _persist() async {
    setState(() => _saving = true);
    final SharedPreferences preferences = await SharedPreferences.getInstance();
    await preferences.setBool('${_prefix}appointments', _appointments);
    await preferences.setBool('${_prefix}messages', _messages);
    await preferences.setBool('${_prefix}alerts', _alerts);
    await preferences.setBool('${_prefix}refills', _refills);
    await preferences.setBool('${_prefix}dailyDigest', _dailyDigest);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Notification preferences saved locally.')));
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: <Widget>[
          const ProviderHeroCard(
            title: 'Notification preferences',
            subtitle: 'Control which provider updates should surface on the mobile device while push registration endpoints are being finalized.',
            badge: 'Local preferences',
          ),
          const SizedBox(height: 20),
          ProviderCard(
            child: Column(
              children: <Widget>[
                SwitchListTile(
                  value: _appointments,
                  title: const Text('Appointments'),
                  subtitle: const Text('New bookings, confirmations, and reschedules'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _appointments = value),
                ),
                SwitchListTile(
                  value: _messages,
                  title: const Text('Messages'),
                  subtitle: const Text('Secure patient and admin communication'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _messages = value),
                ),
                SwitchListTile(
                  value: _alerts,
                  title: const Text('Clinical alerts'),
                  subtitle: const Text('Urgent safety and monitoring alerts'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _alerts = value),
                ),
                SwitchListTile(
                  value: _refills,
                  title: const Text('Refill queue'),
                  subtitle: const Text('Assignment, escalation, and review activity'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _refills = value),
                ),
                SwitchListTile(
                  value: _dailyDigest,
                  title: const Text('Daily digest'),
                  subtitle: const Text('Once-daily operational summary'),
                  contentPadding: EdgeInsets.zero,
                  onChanged: (bool value) => setState(() => _dailyDigest = value),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: _saving ? null : _persist,
            icon: const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Saving…' : 'Save preferences'),
          ),
        ],
      ),
    );
  }
}
