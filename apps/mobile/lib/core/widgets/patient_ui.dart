import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme/app_colors.dart';
import '../state/app_session.dart';

class PatientScaffold extends StatelessWidget {
  const PatientScaffold({
    required this.child,
    this.title,
    this.subtitle,
    this.actions,
    this.currentIndex,
    this.showNavigation = true,
    this.bottomAction,
    this.floatingActionButton,
    this.backgroundGradient = false,
    this.showBack = false,
    super.key,
  });

  final Widget child;
  final String? title;
  final String? subtitle;
  final List<Widget>? actions;
  final int? currentIndex;
  final bool showNavigation;
  final Widget? bottomAction;
  final Widget? floatingActionButton;
  final bool backgroundGradient;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final Widget body = Container(
      decoration: backgroundGradient
          ? const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: <Color>[Color(0xFFE9F9FF), AppColors.background],
              ),
            )
          : null,
      child: SafeArea(
        bottom: bottomAction == null,
        child: Column(
          children: <Widget>[
            if (title != null || actions != null || showBack)
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (showBack)
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: IconButton.filledTonal(
                          onPressed: () {
                            if (context.canPop()) {
                              context.pop();
                              return;
                            }
                            context.go(AppSession.instance.isAuthenticated ? '/home' : '/entry');
                          },
                          icon: const Icon(Icons.arrow_back),
                        ),
                      ),
                    if (title != null)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(title!, style: Theme.of(context).textTheme.headlineMedium),
                            if ((subtitle ?? '').isNotEmpty) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(subtitle!, style: Theme.of(context).textTheme.bodyMedium),
                            ],
                          ],
                        ),
                      ),
                    if (actions != null) ...actions!,
                  ],
                ),
              ),
            Expanded(child: child),
          ],
        ),
      ),
    );

    final String routePath = GoRouterState.of(context).uri.path;
    final int navigationIndex = currentIndex ?? _patientNavigationIndexFor(routePath);
    final bool showGlobalNavigation = AppSession.instance.isAuthenticated &&
        !_isPatientNavigationExcluded(routePath) &&
        (showNavigation || navigationIndex >= 0);
    final Widget? navigation = showGlobalNavigation ? PatientBottomNav(currentIndex: navigationIndex.clamp(0, 3).toInt()) : null;

    return Scaffold(
      body: body,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomAction == null
          ? navigation
          : Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                bottomAction!,
                if (navigation != null) navigation,
              ],
            ),
    );
  }
}


int _patientNavigationIndexFor(String path) {
  if (path.startsWith('/appointments') || path.startsWith('/booking') || path.startsWith('/providers')) return 1;
  if (path.startsWith('/messages')) return 2;
  if (path.startsWith('/records') || path.startsWith('/labs') || path.startsWith('/prescriptions') || path.startsWith('/rpm')) return 3;
  return 0;
}

bool _isPatientNavigationExcluded(String path) {
  return path == '/' ||
      path.startsWith('/entry') ||
      path.startsWith('/language') ||
      path.startsWith('/sign-in') ||
      path.startsWith('/otp') ||
      path.startsWith('/consent') ||
      path.startsWith('/profile-setup');
}

class PatientBottomNav extends StatelessWidget {
  const PatientBottomNav({required this.currentIndex, super.key});

  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    const List<_NavItem> items = <_NavItem>[
      _NavItem(label: 'Home', icon: Icons.home_rounded, route: '/home'),
      _NavItem(label: 'Appointments', icon: Icons.calendar_month_rounded, route: '/appointments/upcoming'),
      _NavItem(label: 'Messages', icon: Icons.chat_bubble_rounded, route: '/messages/inbox'),
      _NavItem(label: 'Records', icon: Icons.folder_shared_rounded, route: '/records/hub'),
    ];

    return SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppColors.border),
          boxShadow: const <BoxShadow>[
            BoxShadow(color: Color(0x120F172A), blurRadius: 20, offset: Offset(0, 10)),
          ],
        ),
        child: Row(
          children: List<Widget>.generate(items.length, (int index) {
            final _NavItem item = items[index];
            final bool selected = index == currentIndex;
            return Expanded(
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => context.go(item.route),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primarySoft : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Icon(item.icon, color: selected ? AppColors.primaryDark : AppColors.textSecondary, size: 22),
                      const SizedBox(height: 4),
                      Text(
                        item.label,
                        style: TextStyle(
                          color: selected ? AppColors.primaryDark : AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class PatientHeroCard extends StatelessWidget {
  const PatientHeroCard({
    required this.title,
    required this.subtitle,
    this.badge,
    this.child,
    super.key,
  });

  final String title;
  final String subtitle;
  final String? badge;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: <Color>[Color(0xFF15B9D7), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if ((badge ?? '').isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                badge!,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            ),
          if ((badge ?? '').isNotEmpty) const SizedBox(height: 16),
          Text(title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Colors.white)),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white.withValues(alpha: 0.88))),
          if (child != null) ...<Widget>[const SizedBox(height: 18), child!],
        ],
      ),
    );
  }
}

class PatientCard extends StatelessWidget {
  const PatientCard({required this.child, this.padding = const EdgeInsets.all(18), super.key});

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
        boxShadow: const <BoxShadow>[
          BoxShadow(color: Color(0x0A0F172A), blurRadius: 16, offset: Offset(0, 8)),
        ],
      ),
      child: child,
    );
  }
}

class PatientTintedCard extends StatelessWidget {
  const PatientTintedCard({required this.child, required this.tint, super.key});

  final Widget child;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
      ),
      child: child,
    );
  }
}

class PatientMetricCard extends StatelessWidget {
  const PatientMetricCard({
    required this.label,
    required this.value,
    required this.caption,
    this.icon,
    this.onTap,
    super.key,
  });

  final String label;
  final String value;
  final String caption;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: PatientCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            if (icon != null)
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: AppColors.primaryDark),
              ),
            if (icon != null) const SizedBox(height: 14),
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 22)),
            const SizedBox(height: 6),
            Text(caption, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class PatientActiveProfileCard extends StatelessWidget {
  const PatientActiveProfileCard({required this.label, this.relationship, super.key});

  final String label;
  final String? relationship;

  @override
  Widget build(BuildContext context) {
    return PatientTintedCard(
      tint: const Color(0xFFF0F9FF),
      child: Row(
        children: <Widget>[
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.family_restroom_outlined, color: AppColors.primaryDark),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Active family profile', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(relationship == null || relationship!.isEmpty ? label : '$label • $relationship', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text('Records, labs, prescriptions, and appointments shown here are isolated to the selected dependent.', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PatientTag extends StatelessWidget {
  const PatientTag({required this.label, this.icon, this.backgroundColor, this.foregroundColor, super.key});

  final String label;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final Color bg = backgroundColor ?? AppColors.surfaceTint;
    final Color fg = foregroundColor ?? AppColors.textPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[Icon(icon, size: 16, color: fg), const SizedBox(width: 6)],
          Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700, fontSize: 12.5)),
        ],
      ),
    );
  }
}

class PatientSectionTitle extends StatelessWidget {
  const PatientSectionTitle({required this.title, this.actionLabel, this.onAction, super.key});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if ((actionLabel ?? '').isNotEmpty) TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    );
  }
}

class PatientStatusBadge extends StatelessWidget {
  const PatientStatusBadge({required this.label, super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final String normalized = label.toUpperCase();
    Color bg = AppColors.surfaceTint;
    Color fg = AppColors.textPrimary;
    if (normalized.contains('CONFIRMED') || normalized.contains('COMPLETED') || normalized.contains('LIVE') || normalized.contains('ACTIVE')) {
      bg = AppColors.successSoft;
      fg = AppColors.success;
    } else if (normalized.contains('PENDING') || normalized.contains('REQUESTED') || normalized.contains('WAIT')) {
      bg = AppColors.warningSoft;
      fg = const Color(0xFFB45309);
    } else if (normalized.contains('CANCEL') || normalized.contains('DECLINED') || normalized.contains('MISSED')) {
      bg = AppColors.dangerSoft;
      fg = AppColors.danger;
    } else if (normalized.contains('REVIEW') || normalized.contains('HOLD')) {
      bg = AppColors.infoSoft;
      fg = AppColors.info;
    }
    return PatientTag(label: label, backgroundColor: bg, foregroundColor: fg);
  }
}

class PatientInfoRow extends StatelessWidget {
  const PatientInfoRow({required this.label, required this.value, this.icon, super.key});

  final String label;
  final String value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Container(
              width: 30,
              height: 30,
              margin: const EdgeInsets.only(right: 10),
              decoration: BoxDecoration(color: AppColors.surfaceTint, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 16, color: AppColors.primaryDark),
            ),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 3),
                Text(value, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class PatientTimelineStep extends StatelessWidget {
  const PatientTimelineStep({required this.title, required this.subtitle, this.trailing, this.isLast = false, super.key});

  final String title;
  final String subtitle;
  final Widget? trailing;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Column(
          children: <Widget>[
            Container(
              width: 14,
              height: 14,
              decoration: const BoxDecoration(color: AppColors.primary, shape: BoxShape.circle),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 52,
                color: AppColors.border,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 0, bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(child: Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
                    if (trailing != null) trailing!,
                  ],
                ),
                const SizedBox(height: 4),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class PatientActionTile extends StatelessWidget {
  const PatientActionTile({required this.title, required this.subtitle, required this.icon, this.onTap, super.key});

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
        child: Row(
          children: <Widget>[
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(16)),
              child: Icon(icon, color: AppColors.primaryDark),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}

class PatientProgressStrip extends StatelessWidget {
  const PatientProgressStrip({required this.label, required this.progress, required this.caption, super.key});

  final String label;
  final double progress;
  final String caption;

  @override
  Widget build(BuildContext context) {
    final double safeProgress = progress.clamp(0, 1).toDouble();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
            Text('${(safeProgress * 100).round()}%', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(value: safeProgress, minHeight: 10, backgroundColor: AppColors.backgroundMuted),
        ),
        const SizedBox(height: 8),
        Text(caption, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class PatientEmptyState extends StatelessWidget {
  const PatientEmptyState({required this.title, required this.body, this.icon = Icons.inbox_outlined, this.action, super.key});

  final String title;
  final String body;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      child: Column(
        children: <Widget>[
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(18)),
            child: Icon(icon, color: AppColors.primaryDark),
          ),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18), textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(body, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
          if (action != null) ...<Widget>[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}

class _NavItem {
  const _NavItem({required this.label, required this.icon, required this.route});

  final String label;
  final IconData icon;
  final String route;
}
