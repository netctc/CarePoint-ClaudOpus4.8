import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class ProviderReviewsPage extends StatelessWidget {
  const ProviderReviewsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final String providerName = draft.providerName ?? 'Selected provider';
    final String visitType = draft.serviceMode == 'In-Person' ? 'In-person visit' : 'Online consultation';

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Provider reviews',
      subtitle: 'Quality and experience signals before you book.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(label: 'Continue to select service', icon: Icons.arrow_forward, onPressed: () => context.go('/providers/service')),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: '4.8 / 5 average rating',
            title: providerName,
            subtitle: 'Based on 126 verified patient reviews across care quality, communication, and follow-up support.',
          ),
          const SizedBox(height: 18),
          const _RatingBreakdownRow(label: 'Communication', value: 4.9),
          const SizedBox(height: 10),
          const _RatingBreakdownRow(label: 'Wait time', value: 4.7),
          const SizedBox(height: 10),
          const _RatingBreakdownRow(label: 'Care quality', value: 4.9),
          const SizedBox(height: 10),
          const _RatingBreakdownRow(label: 'Follow-up support', value: 4.8),
          const SizedBox(height: 18),
          const PatientSectionTitle(title: 'Recent reviews'),
          const SizedBox(height: 12),
          _ReviewCard(
            reviewer: 'A verified patient',
            rating: 5,
            title: 'Excellent follow-up consultation',
            review: 'Very clear explanation of my treatment plan. The online consultation was smooth and the provider reviewed my monitoring results carefully.',
            visitType: visitType,
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            reviewer: 'A verified patient',
            rating: 5,
            title: 'Professional and reassuring',
            review: 'The clinic visit was well organized. The provider explained each next step and all available location options for future visits.',
            visitType: visitType,
          ),
          const SizedBox(height: 12),
          _ReviewCard(
            reviewer: 'A verified patient',
            rating: 4,
            title: 'Helpful overall experience',
            review: 'Booking was easy and I appreciated that both online and in-person services were clearly listed before selection.',
            visitType: visitType,
          ),
        ],
      ),
    );
  }
}

class _RatingBreakdownRow extends StatelessWidget {
  const _RatingBreakdownRow({required this.label, required this.value});

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700))),
          SizedBox(
            width: 110,
            child: LinearProgressIndicator(
              value: value / 5,
              minHeight: 8,
              borderRadius: BorderRadius.circular(100),
              backgroundColor: AppColors.primarySoft,
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
            ),
          ),
          const SizedBox(width: 12),
          Text(value.toStringAsFixed(1), style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.reviewer, required this.rating, required this.title, required this.review, required this.visitType});

  final String reviewer;
  final int rating;
  final String title;
  final String review;
  final String visitType;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: AppColors.primarySoft, borderRadius: BorderRadius.circular(14)),
                child: const Icon(Icons.person_outline, color: AppColors.primaryDark),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(reviewer, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(visitType, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
              Row(
                children: List<Widget>.generate(5, (int index) => Icon(index < rating ? Icons.star : Icons.star_border, size: 18, color: AppColors.warning)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(review, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
        ],
      ),
    );
  }
}
