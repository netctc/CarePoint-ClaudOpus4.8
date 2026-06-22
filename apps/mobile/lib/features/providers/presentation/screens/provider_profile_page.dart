import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class ProviderProfilePage extends StatelessWidget {
  const ProviderProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final Map<String, dynamic> provider = draft.providerSnapshot ?? <String, dynamic>{};
    final List<String> locations = draft.locationOptions;
    final List<String> services = draft.serviceOptions;
    final String name = draft.providerName ?? provider['name']?.toString() ?? 'Selected provider';
    final String specialty = draft.specialty ?? provider['specialty']?.toString() ?? 'General Practice';
    final String serviceMode = draft.serviceMode;
    final String providerType = provider['hspModelLabel']?.toString() ?? provider['providerType']?.toString() ?? 'Provider';
    final String nextSlot = provider['nextAvailableLabel']?.toString() ?? 'Next available this week';

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Provider profile',
      subtitle: 'Review the clinician and continue into service and slot selection.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            AppPrimaryButton(label: 'Continue to select service', icon: Icons.arrow_forward, onPressed: () => context.go('/providers/service')),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => context.go('/providers/reviews'),
                icon: const Icon(Icons.star_outline),
                label: const Text('View reviews'),
              ),
            ),
          ],
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: 'Provider workspace',
            title: name,
            subtitle: specialty,
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                PatientTag(label: providerType, icon: Icons.badge_outlined),
                PatientTag(label: serviceMode, icon: Icons.sync_alt_outlined),
                PatientTag(label: draft.priceLabel, icon: Icons.payments_outlined),
                PatientTag(label: nextSlot, icon: Icons.schedule_outlined),
              ],
            ),
          ),
          const SizedBox(height: 18),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'About this provider'),
                const SizedBox(height: 12),
                Text(
                  'Use this page to confirm the provider, review whether this is an individual, institutional, or organization-based HSP, and see the services and locations attached to the live discovery record.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'Available services'),
                const SizedBox(height: 12),
                ...services.map((String service) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: <Widget>[
                          const Icon(Icons.check_circle_outline, color: AppColors.primaryDark, size: 18),
                          const SizedBox(width: 10),
                          Expanded(child: Text(service, style: Theme.of(context).textTheme.bodyLarge)),
                        ],
                      ),
                    )),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'Facility & delivery options'),
                const SizedBox(height: 12),
                ...locations.map((String location) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Row(
                        children: <Widget>[
                          Icon(location.toLowerCase().contains('virtual') ? Icons.videocam_outlined : Icons.location_on_outlined, color: AppColors.primaryDark, size: 18),
                          const SizedBox(width: 10),
                          Expanded(child: Text(location, style: Theme.of(context).textTheme.bodyLarge)),
                        ],
                      ),
                    )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
