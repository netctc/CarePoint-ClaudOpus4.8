import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderTeamPage extends StatefulWidget {
  const ProviderTeamPage({super.key});

  @override
  State<ProviderTeamPage> createState() => _ProviderTeamPageState();
}

class _ProviderTeamPageState extends State<ProviderTeamPage> {
  static const List<String> _reasonCodes = <String>[
    'CROSS_COVERAGE',
    'ON_CALL',
    'ESCALATED_REVIEW',
    'LAB_RELEASE_BACKUP',
    'MEDICATION_RECONCILIATION',
    'TEMPORARY_TEAM_ASSIGNMENT',
  ];

  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.teamSummary(),
      'members': await api.teamMembers(),
      'exceptions': await api.chartAccessExceptions(),
    };
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _requestException() async {
    String reasonCode = _reasonCodes.first;
    final TextEditingController patientController = TextEditingController();
    final TextEditingController noteController = TextEditingController();
    final TextEditingController expiresAtController = TextEditingController();

    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocalState) => AlertDialog(
          title: const Text('Request chart access exception'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                TextField(
                  controller: patientController,
                  decoration: const InputDecoration(labelText: 'Patient profile ID'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: reasonCode,
                  decoration: const InputDecoration(labelText: 'Reason code'),
                  items: _reasonCodes.map((value) => DropdownMenuItem<String>(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setLocalState(() => reasonCode = value);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: expiresAtController,
                  decoration: const InputDecoration(labelText: 'Expires at (optional ISO datetime)'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteController,
                  decoration: const InputDecoration(labelText: 'Clinical note'),
                  maxLines: 4,
                ),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Submit')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    if (patientController.text.trim().length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid patient profile ID.')));
      return;
    }

    setState(() => _submitting = true);
    try {
      await ProviderSession.instance.api.createChartAccessException(
        patientId: patientController.text.trim(),
        reasonCode: reasonCode,
        note: noteController.text.trim(),
        expiresAt: expiresAtController.text.trim(),
      );
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Chart access exception requested.')));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _revokeException(String exceptionId) async {
    final TextEditingController noteController = TextEditingController(text: 'Revoked from provider mobile.');
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Revoke chart access exception'),
        content: TextField(
          controller: noteController,
          decoration: const InputDecoration(labelText: 'Revocation note'),
          maxLines: 3,
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Revoke')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      await ProviderSession.instance.api.revokeChartAccessException(exceptionId, note: noteController.text.trim());
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Chart access exception revoked.')));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> summary = pickMap(snapshot.data?['summary'], const <String>['summary', 'overview']);
        final List<Map<String, dynamic>> members = pickList(snapshot.data?['members'], const <String>['members', 'items']);
        final List<Map<String, dynamic>> exceptions = pickList(snapshot.data?['exceptions'], const <String>['items', 'exceptions']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Team workspace',
                  subtitle: 'Review care-team members and request or revoke chart access exceptions when cross-coverage is needed.',
                  badge: 'Collaboration',
                  trailing: FilledButton.icon(
                    onPressed: _submitting ? null : _requestException,
                    icon: const Icon(Icons.lock_open_rounded),
                    label: const Text('Request access'),
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
                    MetricCard(label: 'Members', value: '${members.length}'),
                    MetricCard(label: 'Open exceptions', value: '${readInt(summary, const <String>['chartAccessExceptions', 'exceptions'])}', variant: MetricVariant.warning),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Active chart access exceptions'),
                const SizedBox(height: 12),
                if (exceptions.isEmpty)
                  const EmptyStateCard(
                    title: 'No active exceptions',
                    subtitle: 'Temporary chart access approvals will appear here when your team requests them.',
                    icon: Icons.lock_person_outlined,
                  )
                else
                  ...exceptions.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['patientId', 'id'], fallback: 'Chart access exception'), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'ACTIVE')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(item, const <String>['reasonCode'], fallback: 'Temporary access')),
                              const SizedBox(height: 6),
                              Text('Expires: ${formatDateTimeLabel(readString(item, const <String>['expiresAt'], fallback: ''))}'),
                              const SizedBox(height: 12),
                              Align(
                                alignment: Alignment.centerRight,
                                child: OutlinedButton(
                                  onPressed: _submitting ? null : () => _revokeException(readString(item, const <String>['id'], fallback: '')),
                                  child: const Text('Revoke'),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Care-team members'),
                const SizedBox(height: 12),
                if (members.isEmpty)
                  const EmptyStateCard(title: 'No team members found', subtitle: 'Provider team members will appear here when available.', icon: Icons.groups_outlined)
                else
                  ...members.map((member) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              const CircleAvatar(child: Icon(Icons.person_outline_rounded)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(member, const <String>['name', 'fullName', 'email']), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(member, const <String>['role', 'title'], fallback: 'Team member')),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(member, const <String>['status'], fallback: 'Active')),
                            ],
                          ),
                        ),
                      )),
              ],
            ),
          ),
        );
      },
    );
  }
}
