import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/localization/app_localizations.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';

class FamilyProfilesDependentsPage extends StatefulWidget {
  const FamilyProfilesDependentsPage({super.key});

  @override
  State<FamilyProfilesDependentsPage> createState() => _FamilyProfilesDependentsPageState();
}

class _FamilyProfilesDependentsPageState extends State<FamilyProfilesDependentsPage> {
  late Future<_FamilyData> _future;
  bool _addingMember = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_FamilyData> _load() async {
    final List<dynamic> responses = await Future.wait<dynamic>(<Future<dynamic>>[
      AppSession.instance.patientFamilySummary(),
      AppSession.instance.patientFamilyProfiles(),
    ]);
    return _FamilyData(
      summary: (((responses[0] as Map<String, dynamic>)['summary']) as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{},
      profiles: (((responses[1] as Map<String, dynamic>)['items']) as List<dynamic>? ?? <dynamic>[]).whereType<Map>().map((Map item) => item.cast<String, dynamic>()).toList(),
    );
  }

  Future<void> _refresh() async {
    final Future<_FamilyData> refreshed = _load();
    setState(() { _future = refreshed; });
    await refreshed;
  }

  Future<void> _addFamilyMember() async {
    final TextEditingController nameController = TextEditingController();
    final TextEditingController dobController = TextEditingController();
    String relationship = 'Child';
    String gender = 'Prefer not to say';
    String? validationError;
    final l10n = context.l10n;

    final Map<String, dynamic>? payload = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(context).viewInsets.bottom + 24,
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, StateSetter setModalState) {
              return SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(l10n.t('family.addMember'), style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(l10n.t('family.addMemberBody')),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('family.memberName'), controller: nameController),
                    if ((validationError ?? '').isNotEmpty) ...<Widget>[
                      const SizedBox(height: 8),
                      Text(
                        validationError!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: relationship,
                      decoration: InputDecoration(labelText: l10n.t('family.relationship')),
                      items: const <String>['Child', 'Spouse', 'Parent', 'Sibling', 'Other']
                          .map((String value) => DropdownMenuItem<String>(value: value, child: Text(value)))
                          .toList(),
                      onChanged: (String? value) => setModalState(() => relationship = value ?? 'Child'),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: gender,
                      decoration: InputDecoration(labelText: l10n.t('profile.gender')),
                      items: const <String>['Female', 'Male', 'Prefer not to say']
                          .map((String value) => DropdownMenuItem<String>(value: value, child: Text(value)))
                          .toList(),
                      onChanged: (String? value) => setModalState(() => gender = value ?? 'Prefer not to say'),
                    ),
                    const SizedBox(height: 12),
                    AppTextField(label: l10n.t('family.dateOfBirthOptional'), controller: dobController),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.of(context).pop(),
                            child: Text(l10n.t('common.cancel')),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () {
                              if (nameController.text.trim().isEmpty) {
                                setModalState(() => validationError = l10n.t('family.validationName'));
                                return;
                              }
                              Navigator.of(context).pop(<String, dynamic>{
                                'profileName': nameController.text.trim(),
                                'relationship': relationship,
                                'accessLevel': 'Managed by account owner',
                                'permissions': <String>['BOOKING'],
                                'dateOfBirth': dobController.text.trim(),
                                'gender': gender,
                                'status': 'ACTIVE',
                              });
                            },
                            child: Text(l10n.t('common.done')),
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

    if (payload == null || _addingMember) return;

    setState(() => _addingMember = true);
    try {
      await AppSession.instance.createFamilyProfile(payload);
      await _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.t('family.createSuccess'))));
    } catch (error) {
      if (!mounted) return;
      final String message = AppSession.instance.lastError?.trim().isNotEmpty == true
          ? AppSession.instance.lastError!.trim()
          : l10n.t('family.createError');
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _addingMember = false);
    }
  }

  Future<void> _switchToFamilyProfile(Map<String, dynamic> profile) async {
    await AppSession.instance.selectFamilySubject(
      profileId: profile['id']?.toString() ?? '',
      label: profile['profileName']?.toString() ?? profile['title']?.toString() ?? 'Family member',
      relationship: profile['relationship']?.toString(),
    );
    if (!mounted) return;
    context.go('/profile-setup');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return PatientScaffold(
      title: l10n.t('family.title'),
      subtitle: l10n.t('family.subtitle'),
      showBack: true,
      showNavigation: false,
      child: FutureBuilder<_FamilyData>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<_FamilyData> snapshot) {
          if (snapshot.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snapshot.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: PatientEmptyState(
                title: l10n.t('family.loadErrorTitle'),
                body: snapshot.error.toString(),
                icon: Icons.family_restroom_outlined,
                action: FilledButton.tonal(onPressed: _refresh, child: Text(l10n.t('common.retry'))),
              ),
            );
          }
          final _FamilyData data = snapshot.data!;
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: '${data.profiles.length} ${l10n.t('family.profileCount')}',
                title: l10n.t('family.heroTitle'),
                subtitle: l10n.t('family.heroBody'),
                child: FilledButton.tonalIcon(
                  onPressed: _addingMember ? null : _addFamilyMember,
                  icon: _addingMember
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.add),
                  label: Text(l10n.t('family.addMember')),
                ),
              ),
              const SizedBox(height: 18),
              PatientCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(l10n.t('family.currentContext'), style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        ActionChip(
                          label: Text(AppSession.instance.isSelfSubject ? l10n.t('family.selfProfile') : l10n.t('family.switchToSelf')),
                          onPressed: () async {
                            await AppSession.instance.selectSelfSubject();
                            if (!mounted) return;
                            setState(() {});
                          },
                        ),
                        if (!AppSession.instance.isSelfSubject) PatientStatusBadge(label: AppSession.instance.activeSubjectLabel),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              if (data.profiles.isEmpty)
                PatientEmptyState(
                  title: l10n.t('family.addMember'),
                  body: l10n.t('family.addMemberBody'),
                  icon: Icons.family_restroom_outlined,
                  action: FilledButton.tonalIcon(
                    onPressed: _addingMember ? null : _addFamilyMember,
                    icon: const Icon(Icons.add),
                    label: Text(l10n.t('family.addMember')),
                  ),
                )
              else
                ...data.profiles.map((Map<String, dynamic> profile) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: PatientCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: Text(
                                  profile['profileName']?.toString() ?? profile['title']?.toString() ?? 'Family profile',
                                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ),
                              PatientStatusBadge(label: profile['relationship']?.toString() ?? 'Dependent'),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(profile['accessLevel']?.toString() ?? l10n.t('family.defaultAccessLevel')),
                          if (((profile['pendingPermissions'] as List?)?.isNotEmpty ?? false)) ...<Widget>[
                            const SizedBox(height: 6),
                            Text(
                              l10n.t('family.pendingMedicalAccess'),
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.primary),
                            ),
                          ],
                          const SizedBox(height: 6),
                          Text('${l10n.t('family.dataIsolation')}: ${l10n.t('family.dataIsolationBody')}'),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: <Widget>[
                              FilledButton.tonal(
                                onPressed: () => _switchToFamilyProfile(profile),
                                child: Text(l10n.t('family.switchToProfile')),
                              ),
                              if ((profile['consentStatus']?.toString() ?? '').toUpperCase() == 'VERIFIED')
                                FilledButton.tonal(
                                  onPressed: () => AppSession.instance.inviteFamilyProfile(profile['id']?.toString() ?? ''),
                                  child: Text(l10n.t('family.invite')),
                                ),
                            ],
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

class _FamilyData {
  const _FamilyData({required this.summary, required this.profiles});
  final Map<String, dynamic> summary;
  final List<Map<String, dynamic>> profiles;
}
