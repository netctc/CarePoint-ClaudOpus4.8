import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_colors.dart';
import '../state/provider_session.dart';

class ProviderShell extends StatelessWidget {
  const ProviderShell({required this.child, super.key});

  final Widget child;

  static const List<_ShellItem> _primaryNav = <_ShellItem>[
    _ShellItem(label: 'Dashboard', icon: Icons.space_dashboard_rounded, route: '/dashboard'),
    _ShellItem(label: 'Queue', icon: Icons.event_note_rounded, route: '/queue'),
    _ShellItem(label: 'Messages', icon: Icons.chat_bubble_rounded, route: '/messages'),
    _ShellItem(label: 'Calendar', icon: Icons.calendar_month_rounded, route: '/calendar'),
  ];

  static const List<_ShellItem> _drawerNav = <_ShellItem>[
    _ShellItem(label: 'Alerts', icon: Icons.warning_amber_rounded, route: '/alerts'),
    _ShellItem(label: 'Telehealth', icon: Icons.video_camera_front_rounded, route: '/telehealth'),
    _ShellItem(label: 'Records', icon: Icons.folder_shared_rounded, route: '/records'),
    _ShellItem(label: 'Orders', icon: Icons.science_rounded, route: '/orders'),
    _ShellItem(label: 'Prescriptions', icon: Icons.medication_rounded, route: '/prescriptions'),
    _ShellItem(label: 'Labs', icon: Icons.biotech_rounded, route: '/labs'),
    _ShellItem(label: 'RPM', icon: Icons.monitor_heart_rounded, route: '/rpm'),
    _ShellItem(label: 'Analytics', icon: Icons.query_stats_rounded, route: '/analytics'),
    _ShellItem(label: 'Team', icon: Icons.groups_rounded, route: '/team'),
    _ShellItem(label: 'Settings', icon: Icons.settings_rounded, route: '/settings'),
  ];

  @override
  Widget build(BuildContext context) {
    final String location = GoRouterState.of(context).uri.path;
    final ProviderSession session = ProviderSession.instance;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titleForLocation(location)),
        actions: <Widget>[
          IconButton(
            tooltip: session.isRtl ? 'English' : 'العربية',
            onPressed: () => session.setLanguage(session.languageCode == 'ar' ? 'en' : 'ar'),
            icon: const Icon(Icons.language_rounded),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: <Widget>[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: <Color>[AppColors.primary, AppColors.accent],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const CircleAvatar(radius: 28, backgroundColor: Colors.white24, child: Icon(Icons.local_hospital_rounded, color: Colors.white, size: 30)),
                    const SizedBox(height: 16),
                    Text(session.displayName, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                    const SizedBox(height: 4),
                    Text(session.roleLabel, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.9))),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  children: <Widget>[
                    for (final _ShellItem item in <_ShellItem>[..._primaryNav, ..._drawerNav])
                      ListTile(
                        leading: Icon(item.icon),
                        title: Text(item.label),
                        selected: location == item.route || location.startsWith('${item.route}/'),
                        onTap: () {
                          Navigator.of(context).pop();
                          context.go(item.route);
                        },
                      ),
                  ],
                ),
              ),
              ListTile(
                leading: const Icon(Icons.logout_rounded),
                title: const Text('Sign out'),
                onTap: () async {
                  Navigator.of(context).pop();
                  await session.logout();
                  if (context.mounted) {
                    context.go('/welcome');
                  }
                },
              ),
            ],
          ),
        ),
      ),
      body: child,
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: AppColors.border),
            boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x120F172A), blurRadius: 20, offset: Offset(0, 10))],
          ),
          child: Row(
            children: List<Widget>.generate(_primaryNav.length, (int index) {
              final _ShellItem item = _primaryNav[index];
              final bool selected = location == item.route || location.startsWith('${item.route}/');
              return Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () => context.go(item.route),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primarySoft : Colors.transparent,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Icon(item.icon, size: 22, color: selected ? AppColors.primaryDark : AppColors.textSecondary),
                        const SizedBox(height: 4),
                        Text(
                          item.label,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: selected ? AppColors.primaryDark : AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  String _titleForLocation(String location) {
    final String category = ProviderSession.instance.categoryLabel;
    if (location.startsWith('/dashboard')) return '$category Dashboard';
    if (location.startsWith('/queue')) return '$category Queue';
    if (location.startsWith('/appointments/')) return 'Appointment Detail';
    if (location.startsWith('/chart/')) return 'Patient Chart';
    if (location.startsWith('/encounters/')) return 'Encounter Note';
    if (location.startsWith('/calendar/manage')) return 'Schedule Manager';
    if (location.startsWith('/calendar')) return 'Calendar';
    if (location.startsWith('/messages/thread')) return 'Conversation';
    if (location.startsWith('/messages')) return 'Messages';
    if (location.startsWith('/alerts')) return 'Alerts';
    if (location.startsWith('/telehealth/')) return 'Telehealth Session';
    if (location.startsWith('/telehealth')) return 'Telehealth';
    if (location.startsWith('/records/')) return 'Record Detail';
    if (location.startsWith('/records')) return 'Records';
    if (location.startsWith('/orders/new')) return 'New Order';
    if (location.startsWith('/orders/')) return 'Order Detail';
    if (location.startsWith('/orders')) return 'Orders';
    if (location.startsWith('/prescriptions/new')) return 'New Prescription';
    if (location.startsWith('/prescriptions/refills/')) return 'Refill Request';
    if (location.startsWith('/prescriptions/')) return 'Prescription Detail';
    if (location.startsWith('/prescriptions')) return 'Prescriptions';
    if (location.startsWith('/labs/')) return 'Lab Result';
    if (location.startsWith('/labs')) return 'Labs';
    if (location.startsWith('/rpm/')) return 'RPM Patient';
    if (location.startsWith('/rpm')) return 'Remote Patient Monitoring';
    if (location.startsWith('/analytics')) return 'Analytics';
    if (location.startsWith('/team')) return 'Team';
    if (location.startsWith('/settings/offline-queue')) return 'Offline Queue';
    if (location.startsWith('/settings/onboarding')) return '${ProviderSession.instance.categoryLabel} Onboarding';
    if (location.startsWith('/settings/hsp-access')) return 'HSP Access';
    if (location.startsWith('/settings/notifications')) return 'Notification Preferences';
    if (location.startsWith('/settings/facilities/')) return 'Facility Settings';
    if (location.startsWith('/settings')) return 'Settings';
    return 'CarePoint ${ProviderSession.instance.categoryLabel}';
  }
}

class ProviderPage extends StatelessWidget {
  const ProviderPage({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        children: <Widget>[child],
      ),
    );
  }
}

class ProviderCard extends StatelessWidget {
  const ProviderCard({required this.child, this.padding = const EdgeInsets.all(18), super.key});

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x0A0F172A), blurRadius: 16, offset: Offset(0, 8))],
      ),
      child: child,
    );
  }
}

class ProviderHeroCard extends StatelessWidget {
  const ProviderHeroCard({required this.title, required this.subtitle, this.badge, this.trailing, super.key});

  final String title;
  final String subtitle;
  final String? badge;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: <Color>[AppColors.primary, AppColors.accent], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if ((badge ?? '').isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(999)),
              child: Text(badge!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
            ),
          if ((badge ?? '').isNotEmpty) const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white)),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.9))),
          if (trailing != null) ...<Widget>[const SizedBox(height: 18), trailing!],
        ],
      ),
    );
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({required this.label, required this.value, this.variant = MetricVariant.primary, super.key});

  final String label;
  final String value;
  final MetricVariant variant;

  @override
  Widget build(BuildContext context) {
    late final Color tint;
    late final Color accent;
    if (variant == MetricVariant.success) {
      tint = AppColors.successSoft;
      accent = AppColors.success;
    } else if (variant == MetricVariant.warning) {
      tint = AppColors.warningSoft;
      accent = AppColors.warning;
    } else if (variant == MetricVariant.danger) {
      tint = AppColors.dangerSoft;
      accent = AppColors.danger;
    } else {
      tint = AppColors.accentSoft;
      accent = AppColors.accent;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: accent, fontSize: 22)),
        ],
      ),
    );
  }
}

enum MetricVariant { primary, success, warning, danger }

class StatusBadge extends StatelessWidget {
  const StatusBadge(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final String normalized = label.toLowerCase();
    Color background = AppColors.infoSoft;
    Color foreground = AppColors.info;
    if (normalized.contains('success') || normalized.contains('resolved') || normalized.contains('complete') || normalized.contains('live') || normalized.contains('normal') || normalized.contains('active')) {
      background = AppColors.successSoft;
      foreground = AppColors.success;
    } else if (normalized.contains('warning') || normalized.contains('pending') || normalized.contains('hold') || normalized.contains('review')) {
      background = AppColors.warningSoft;
      foreground = AppColors.warning;
    } else if (normalized.contains('critical') || normalized.contains('danger') || normalized.contains('high') || normalized.contains('cancel')) {
      background = AppColors.dangerSoft;
      foreground = AppColors.danger;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: foreground)),
    );
  }
}

class EmptyStateCard extends StatelessWidget {
  const EmptyStateCard({required this.title, required this.subtitle, this.icon = Icons.inbox_rounded, super.key});

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ProviderCard(
      child: Column(
        children: <Widget>[
          Icon(icon, size: 36, color: AppColors.textMuted),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(subtitle, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({required this.title, this.actionLabel, this.onTap, super.key});

  final String title;
  final String? actionLabel;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if ((actionLabel ?? '').isNotEmpty)
          TextButton(onPressed: onTap, child: Text(actionLabel!)),
      ],
    );
  }
}

class ErrorStateCard extends StatelessWidget {
  const ErrorStateCard({required this.message, required this.onRetry, super.key});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ProviderCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('Unable to load data', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(message, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Retry')),
        ],
      ),
    );
  }
}

class LoadingBlock extends StatelessWidget {
  const LoadingBlock({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 40),
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _ShellItem {
  const _ShellItem({required this.label, required this.icon, required this.route});

  final String label;
  final IconData icon;
  final String route;
}
