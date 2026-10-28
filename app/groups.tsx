import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import { useAppContext } from '../src/context/AppContext';
import { calculateChitPlan } from '../src/lib/finance';
import { canManageGroup, getMemberGroups } from '../src/lib/groupAccess';
import { getText } from '../src/lib/i18n';
import type { AdminFeeMode, ChitType, Group, ManagementMode, Visibility } from '../src/types';

interface InviteeDraft {
  name: string;
  contact: string;
}

export default function GroupsScreen() {
  const { state, createGroup, deleteGroup } = useAppContext();
  const scheme = useColorScheme();
  const isDark = state.theme === 'dark' || (state.theme === 'system' && scheme === 'dark');
  const palette = isDark ? darkColors : lightColors;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberCount, setMemberCount] = useState('10');
  const [invitees, setInvitees] = useState<InviteeDraft[]>(createEmptyInvitees(9));
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [inviteMode, setInviteMode] = useState<'code' | 'link' | 'manual'>('code');
  const [chitType, setChitType] = useState<ChitType>('auction');
  const [managementMode, setManagementMode] = useState<ManagementMode>('self-managed');
  const [adminFeeMode, setAdminFeeMode] = useState<AdminFeeMode>('none');
  const [adminFeeAmount, setAdminFeeAmount] = useState('10');
  const [foremanCommissionPercent, setForemanCommissionPercent] = useState('5');
  const [minimumBidDiscount, setMinimumBidDiscount] = useState('500');
  const [bidIncrement, setBidIncrement] = useState<100 | 200 | 500>(200);
  const [fixedDiscountAmount, setFixedDiscountAmount] = useState('500');
  const [totalContributionPerMember, setTotalContributionPerMember] = useState('100000');
  const [instalmentCount, setInstalmentCount] = useState('10');
  const [dueDay, setDueDay] = useState('30');
  const [formError, setFormError] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [summaryEntrance] = useState(() => new Animated.Value(0));

  const user = state.user;
  const userId = user?.id;
  const userName = user?.name;
  const visibleGroups = useMemo(
    () => userId && userName ? getMemberGroups(state.groups, userId, userName) : [],
    [state.groups, userId, userName],
  );
  const publicGroups = useMemo(
    () => state.groups.filter(
      (group) => group.visibility === 'public' && !visibleGroups.some((visible) => visible.id === group.id),
    ),
    [state.groups, visibleGroups],
  );
  const chitPlan = calculateChitPlan(
    Number(totalContributionPerMember),
    Number(memberCount),
    Number(instalmentCount),
  );
  const adminFee = adminFeeMode === 'none' ? 0 : Number(adminFeeAmount) || 0;
  const totalAdminFee = adminFeeMode === 'monthly-per-member'
    ? adminFee * Number(memberCount) * Number(instalmentCount)
    : adminFeeMode === 'one-time-per-member'
      ? adminFee * Number(memberCount)
      : 0;

  useEffect(() => {
    const animation = Animated.timing(summaryEntrance, {
      toValue: 1,
      duration: 450,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [summaryEntrance]);

  const updateMemberCount = (value: string) => {
    const previousCount = Number(memberCount);
    const previousInstalments = Number(instalmentCount);
    setMemberCount(value);
    const total = Number(value);
    if (!Number.isInteger(total) || total < 2 || total > 100) return;
    setInvitees((current) => resizeInvitees(current, total - 1));
    if (previousInstalments === previousCount) setInstalmentCount(value);
  };

  const selectManagementMode = (mode: ManagementMode) => {
    setManagementMode(mode);
    if (mode === 'agent-managed') {
      const commission = Math.floor((chitPlan?.grossMonthlyPot ?? 0) * Number(foremanCommissionPercent) / 100);
      setMinimumBidDiscount((current) => String(Math.max(Number(current) || 0, commission)));
      setFixedDiscountAmount((current) => String(Math.max(Number(current) || 0, commission)));
    }
  };

  const updateInvitee = (index: number, field: keyof InviteeDraft, value: string) => {
    setInvitees((current) => current.map((invitee, memberIndex) =>
      memberIndex === index ? { ...invitee, [field]: value } : invitee,
    ));
  };

  const handleCreate = () => {
    if (!user) {
      router.push('/auth');
      return;
    }
    if (!name.trim()) {
      setFormError('Enter a group name.');
      return;
    }
    const totalMembers = Number(memberCount);
    if (!Number.isInteger(totalMembers) || totalMembers < 2 || totalMembers > 100) {
      setFormError('Choose a group size between 2 and 100 people, including yourself.');
      return;
    }
    const missingNameIndex = invitees.findIndex((invitee) => !invitee.name.trim());
    if (missingNameIndex >= 0) {
      setFormError(`Enter a name for member ${missingNameIndex + 2}.`);
      return;
    }
    const invalidContactIndex = invitees.findIndex(
      (invitee) => invitee.contact.trim() && !isEmailAddress(invitee.contact.trim()) && !isPhoneNumber(invitee.contact.trim()),
    );
    if (invalidContactIndex >= 0) {
      setFormError(`Enter a valid email address or phone number for member ${invalidContactIndex + 2}, or leave it blank.`);
      return;
    }
    const memberNames = invitees.map((invitee) => invitee.name.trim().toLocaleLowerCase());
    if (new Set(memberNames).size !== memberNames.length || memberNames.includes(user.name.trim().toLocaleLowerCase())) {
      setFormError('Each member must have a different name from the others and from you.');
      return;
    }
    const months = Number(instalmentCount);
    const totalPerMember = Number(totalContributionPerMember);
    if (!Number.isInteger(months) || months < 2 || months > 100) {
      setFormError('Choose a chit duration between 2 and 100 months.');
      return;
    }
    if (months !== totalMembers) {
      setFormError('For a standard chit, the number of months must match the number of members so each member gets one winning turn.');
      return;
    }
    const plan = calculateChitPlan(totalPerMember, totalMembers, months);
    if (!plan) {
      setFormError('Enter a positive total amount per member that divides evenly into whole rupees across the chit months.');
      return;
    }
    const contribution = plan.monthlyContribution;
    const adminFee = adminFeeMode === 'none' ? 0 : Number(adminFeeAmount);
    const dueDate = Number(dueDay);
    const minDiscount = Number(minimumBidDiscount);
    const commissionPercent = Number(foremanCommissionPercent);
    const fixedDiscount = Number(fixedDiscountAmount);
    const grossPot = plan.grossMonthlyPot;
    if (!Number.isSafeInteger(contribution) || contribution <= 0) {
      setFormError('Enter a monthly contribution greater than zero.');
      return;
    }
    if (!Number.isSafeInteger(grossPot)) {
      setFormError('The total group pot is too large to calculate safely.');
      return;
    }
    if (adminFeeMode !== 'none' && (!Number.isSafeInteger(adminFee) || adminFee <= 0 || adminFee > 1000000)) {
      setFormError('Enter an admin fee from ₹1 to ₹10,00,000 per member.');
      return;
    }
    if (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 30) {
      setFormError('Choose a due day between 1 and 30.');
      return;
    }
    if (
      !Number.isSafeInteger(commissionPercent)
      || commissionPercent < 0
      || commissionPercent > 7
    ) {
      setFormError('Foreman commission must be from 0% to 7%. Check your state rules and chit agreement.');
      return;
    }
    const commission = managementMode === 'agent-managed'
      ? Math.floor(grossPot * commissionPercent / 100)
      : 0;
    if (
      chitType === 'auction'
      && (!Number.isSafeInteger(minDiscount) || minDiscount < commission || minDiscount > Math.floor(grossPot * 0.3))
    ) {
      setFormError(`Minimum bid discount must be at least the ₹${commission.toLocaleString('en-IN')} agent fee and no more than 30% of the ₹${grossPot.toLocaleString('en-IN')} pot.`);
      return;
    }
    if (
      chitType === 'fixed-discount'
      && (!Number.isSafeInteger(fixedDiscount) || fixedDiscount < commission || fixedDiscount > Math.floor(grossPot * 0.3))
    ) {
      setFormError(`Fixed discount must be at least the ₹${commission.toLocaleString('en-IN')} agent fee and no more than 30% of the pot.`);
      return;
    }
    setFormError('');
    const createdGroupId = createGroup({
      name,
      description,
      visibility,
      inviteMode,
      chitType,
      managementMode,
      foremanCommissionPercent: commissionPercent,
      adminFeeMode,
      adminFeeAmount: adminFee,
      minimumBidDiscount: minDiscount,
      bidIncrement,
      fixedDiscountAmount: fixedDiscount,
      monthlyContribution: contribution,
      memberCount: totalMembers,
      instalmentCount: months,
      dueDay: dueDate,
      members: invitees,
      allowGuestMembers: true,
    });
    setName('');
    setDescription('');
    setMemberCount('10');
    setInvitees(createEmptyInvitees(9));
    setVisibility('private');
    setInviteMode('code');
    setChitType('auction');
    setManagementMode('self-managed');
    setAdminFeeMode('none');
    setAdminFeeAmount('10');
    setForemanCommissionPercent('5');
    setMinimumBidDiscount('500');
    setBidIncrement(200);
    setFixedDiscountAmount('500');
    setTotalContributionPerMember('100000');
    setInstalmentCount('10');
    setDueDay('30');
    router.push({ pathname: '/auction', params: { groupId: createdGroupId } });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.header, { color: palette.text }]}>{getText(state.locale, 'groups')}</Text>

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Create premium chit group</Text>
          <Text style={[styles.label, { color: palette.muted }]}>How many people in the group?</Text>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Include yourself as the group admin. You’ll add a name for every other member.
          </Text>
          <TextInput
            accessibilityLabel="Total group members including you"
            value={memberCount}
            onChangeText={updateMemberCount}
            keyboardType="number-pad"
            maxLength={3}
            placeholder="5"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
          />
          <View style={[styles.ownerRow, { backgroundColor: palette.primarySoft }]}>
            <Text style={[styles.ownerInitials, { color: palette.primary }]}>{user?.initials ?? 'YOU'}</Text>
            <View>
              <Text style={[styles.memberName, { color: palette.text }]}>{user?.name ?? 'You'}</Text>
              <Text style={[styles.memberStatus, { color: palette.muted }]}>You · Group admin</Text>
            </View>
          </View>

          {invitees.map((invitee, index) => (
            <View key={index} style={[styles.inviteeCard, { backgroundColor: palette.softBg, borderColor: palette.border }]}>
              <Text style={[styles.inviteeTitle, { color: palette.text }]}>Member {index + 2}</Text>
              <TextInput
                accessibilityLabel={`Member ${index + 2} name (required)`}
                value={invitee.name}
                onChangeText={(value) => updateInvitee(index, 'name', value)}
                placeholder="Full name (required)"
                placeholderTextColor={palette.muted}
                autoCapitalize="words"
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card }]}
              />
              <TextInput
                accessibilityLabel={`Member ${index + 2} email or phone (optional)`}
                value={invitee.contact}
                onChangeText={(value) => updateInvitee(index, 'contact', value)}
                placeholder="Email or phone (optional)"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.card, marginBottom: 0 }]}
              />
            </View>
          ))}

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Short description"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
          />

          <Text style={[styles.label, { color: palette.muted }]}>Visibility</Text>
          <View style={styles.segmentRow}>
            {(['private', 'public'] as Visibility[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segmentButton, { backgroundColor: visibility === option ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                onPress={() => setVisibility(option)}
              >
                <Text style={[styles.segmentText, { color: visibility === option ? palette.primary : palette.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Invite method</Text>
          <View style={styles.segmentRow}>
            {(['code', 'link', 'manual'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.segmentButton, { backgroundColor: inviteMode === option ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                onPress={() => setInviteMode(option)}
              >
                <Text style={[styles.segmentText, { color: inviteMode === option ? palette.primary : palette.text }]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Chit method</Text>
          <View style={styles.choiceStack}>
            {([
              ['auction', 'Auction / bidding', 'Members bid a discount off the pot. The highest valid discount wins.'],
              ['fixed-discount', 'Fixed discount', 'Use the same agreed discount amount each round.'],
              ['lucky-draw', 'Lucky draw', 'Admin draws a different eligible member each round.'],
            ] as const).map(([method, label, detail]) => (
              <TouchableOpacity
                key={method}
                accessibilityRole="radio"
                accessibilityState={{ checked: chitType === method }}
                onPress={() => setChitType(method)}
                style={[
                  styles.methodChoice,
                  { backgroundColor: chitType === method ? palette.primarySoft : palette.softBg, borderColor: chitType === method ? palette.primary : palette.border },
                ]}
              >
                <Text style={[styles.methodTitle, { color: chitType === method ? palette.primary : palette.text }]}>{label}</Text>
                <Text style={[styles.helperText, { color: palette.muted, marginBottom: 0 }]}>{detail}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: palette.muted }]}>Who manages the chit?</Text>
          <View style={styles.segmentRow}>
            {([
              ['self-managed', 'Self-managed'],
              ['agent-managed', 'Agent-managed'],
            ] as const).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: managementMode === mode }}
                style={[styles.segmentButton, { backgroundColor: managementMode === mode ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                onPress={() => selectManagementMode(mode)}
              >
                <Text style={[styles.segmentText, { color: managementMode === mode ? palette.primary : palette.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {managementMode === 'agent-managed' && (
            <>
              <Text style={[styles.helperText, { color: palette.muted }]}>
                Agent commission is deducted from the winning discount before dividends are shared. Set the agreed rate (up to 7% in the central Act; state rules may differ).
              </Text>
              <TextInput
                accessibilityLabel="Agent commission percent"
                value={foremanCommissionPercent}
                onChangeText={setForemanCommissionPercent}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </>
          )}

          <Text style={[styles.label, { color: palette.muted }]}>Optional admin commission</Text>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            This is collected separately from the chit pot and is not deducted from the winner’s payout. Agree it with all members before starting.
          </Text>
          <View style={styles.segmentRow}>
            {([
              ['none', 'No fee'],
              ['monthly-per-member', 'Per month'],
              ['one-time-per-member', 'Whole chit'],
            ] as const).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: adminFeeMode === mode }}
                onPress={() => setAdminFeeMode(mode)}
                style={[styles.segmentButton, { backgroundColor: adminFeeMode === mode ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
              >
                <Text style={[styles.segmentText, { color: adminFeeMode === mode ? palette.primary : palette.text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {adminFeeMode !== 'none' && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>
                {adminFeeMode === 'monthly-per-member' ? 'Monthly admin fee per member (₹)' : 'One-time admin fee per member (₹)'}
              </Text>
              <TextInput
                accessibilityLabel="Admin fee per member"
                value={adminFeeAmount}
                onChangeText={setAdminFeeAmount}
                keyboardType="number-pad"
                maxLength={7}
                placeholder={adminFeeMode === 'monthly-per-member' ? '10' : '100'}
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </>
          )}

          {chitType === 'auction' && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>Minimum auction discount (₹)</Text>
              <Text style={[styles.helperText, { color: palette.muted }]}>The lowest discount a bidder can offer. The central Act generally caps discount at 30% of the gross pot.</Text>
              <TextInput
                accessibilityLabel="Minimum auction discount"
                value={minimumBidDiscount}
                onChangeText={setMinimumBidDiscount}
                keyboardType="number-pad"
                placeholder="500"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
              <Text style={[styles.label, { color: palette.muted }]}>Raise bid by</Text>
              <View style={styles.segmentRow}>
                {([100, 200, 500] as const).map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: bidIncrement === amount }}
                    onPress={() => setBidIncrement(amount)}
                    style={[styles.segmentButton, { backgroundColor: bidIncrement === amount ? palette.primarySoft : palette.softBg, borderColor: palette.border }]}
                  >
                    <Text style={[styles.segmentText, { color: bidIncrement === amount ? palette.primary : palette.text }]}>₹{amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {chitType === 'fixed-discount' && (
            <>
              <Text style={[styles.label, { color: palette.muted }]}>Agreed fixed discount (₹)</Text>
              <TextInput
                accessibilityLabel="Agreed fixed discount"
                value={fixedDiscountAmount}
                onChangeText={setFixedDiscountAmount}
                keyboardType="number-pad"
                placeholder="500"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </>
          )}

          <View style={styles.doubleRow}>
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: palette.muted }]}>Base subscription per member (₹)</Text>
              <TextInput
                accessibilityLabel="Total contribution per member"
                value={totalContributionPerMember}
                keyboardType="number-pad"
                maxLength={12}
                onChangeText={setTotalContributionPerMember}
                placeholder="100000"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </View>
            <View style={styles.fieldWrap}>
              <Text style={[styles.label, { color: palette.muted }]}>Duration (months)</Text>
              <TextInput
                accessibilityLabel="Chit duration in months"
                value={instalmentCount}
                keyboardType="number-pad"
                maxLength={3}
                onChangeText={setInstalmentCount}
                placeholder="10"
                placeholderTextColor={palette.muted}
                style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
              />
            </View>
          </View>
          <Text style={[styles.helperText, { color: palette.muted }]}>
            Enter each member’s base subscription before auction dividends. For the standard one-winner-per-member cycle, months must equal the number of members.
          </Text>

          <Animated.View
            accessibilityLiveRegion="polite"
            style={[
              styles.planCard,
              {
                backgroundColor: palette.primarySoft,
                opacity: summaryEntrance,
                transform: [{ translateY: summaryEntrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
          >
            <Text style={[styles.planTitle, { color: palette.primary }]}>Your chit plan</Text>
            {chitPlan ? (
              <>
                <View style={styles.planRow}>
                  <Text style={[styles.planLabel, { color: palette.muted }]}>Base installment per member/month</Text>
                  <Text style={[styles.planValue, { color: palette.text }]}>₹{chitPlan.monthlyContribution.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.planRow}>
                  <Text style={[styles.planLabel, { color: palette.muted }]}>Gross pot each month</Text>
                  <Text style={[styles.planValue, { color: palette.text }]}>₹{chitPlan.grossMonthlyPot.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.planRow}>
                  <Text style={[styles.planLabel, { color: palette.muted }]}>Gross scheduled across all rounds</Text>
                  <Text style={[styles.planValue, { color: palette.text }]}>₹{chitPlan.totalGroupContributions.toLocaleString('en-IN')}</Text>
                </View>
                {adminFeeMode !== 'none' && (
                  <View style={styles.planRow}>
                    <Text style={[styles.planLabel, { color: palette.muted }]}>Admin fees scheduled separately</Text>
                    <Text style={[styles.planValue, { color: palette.text }]}>₹{totalAdminFee.toLocaleString('en-IN')}</Text>
                  </View>
                )}
                <Text style={[styles.planNote, { color: palette.muted }]}>
                  {memberCount} members × ₹{chitPlan.monthlyContribution.toLocaleString('en-IN')} × {instalmentCount} months
                </Text>
                <Text style={[styles.planNote, { color: palette.muted }]}>
                  Actual member dues can be lower after that round’s auction dividend.
                </Text>
                {Number(instalmentCount) !== Number(memberCount) && (
                  <Text style={[styles.planWarning, { color: palette.danger }]}>
                    Match months to members to give every member one winning turn.
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.planNote, { color: palette.muted }]}>
                Enter a whole-rupee member total that divides evenly across the duration to preview the monthly payment and pot.
              </Text>
            )}
          </Animated.View>

          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: palette.muted }]}>Due day (1–30)</Text>
            <TextInput
              value={dueDay}
              keyboardType="numeric"
              onChangeText={setDueDay}
              placeholder="30"
              placeholderTextColor={palette.muted}
              style={[styles.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.softBg }]}
            />
          </View>

          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: palette.primary }]} onPress={handleCreate}>
            <Text style={styles.primaryText}>Create & start chit</Text>
          </TouchableOpacity>
        </View>

        {visibleGroups.map((group) => {
          const isAdmin = user ? canManageGroup(group, user.id, user.name) : false;
          return (
          <View key={group.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
              <Text style={[styles.badge, { color: palette.primary, backgroundColor: palette.primarySoft }]}>{group.visibility}</Text>
            </View>
            <Text style={[styles.groupDescription, { color: palette.muted }]}>{group.description}</Text>
            <View style={styles.metaGrid}>
              <InfoBubble label="Invite" value={group.invitationCode} palette={palette} />
              <InfoBubble label="Base / member / month" value={`₹${group.monthlyContribution.toLocaleString('en-IN')}`} palette={palette} />
              <InfoBubble label="Base / member" value={`₹${(group.monthlyContribution * group.instalmentCount).toLocaleString('en-IN')}`} palette={palette} />
              <InfoBubble label="Gross pot / month" value={`₹${group.totalAmount.toLocaleString('en-IN')}`} palette={palette} />
              <InfoBubble label="Members" value={String(group.memberCount)} palette={palette} />
              <InfoBubble label="Rounds" value={String(group.instalmentCount)} palette={palette} />
              <InfoBubble
                label="Admin fee"
                value={group.adminFeeMode === 'none'
                  ? 'None'
                  : `₹${group.adminFeeAmount.toLocaleString('en-IN')} / member${group.adminFeeMode === 'monthly-per-member' ? ' / month' : ' total'}`}
                palette={palette}
              />
              <InfoBubble label="Link" value={group.inviteMode} palette={palette} />
              <InfoBubble label="Method" value={getChitTypeLabel(group.chitType)} palette={palette} />
              <InfoBubble label="Agent" value={group.managementMode === 'agent-managed' ? `${group.foremanCommissionPercent}% fee` : 'Self-managed'} palette={palette} />
            </View>
            <View style={styles.memberList}>
              {(group.members ?? []).slice(0, 4).map((member) => (
                <View key={member.id} style={[styles.memberRow, { backgroundColor: palette.softBg }]}>
                  <Text style={[styles.memberInitials, { backgroundColor: palette.primarySoft, color: palette.primary }]}>{member.name.slice(0, 2).toUpperCase()}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: palette.text }]}>{member.name}</Text>
                    <Text style={[styles.memberStatus, { color: palette.muted }]}>{member.status === 'active' ? 'Active' : 'Pending'} · {member.role}</Text>
                    {(member.email || member.phone) ? (
                      <Text style={[styles.memberStatus, { color: palette.muted }]}>{member.email || member.phone}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            {(group.pendingInvites ?? []).length > 0 && (
              <View style={styles.pendingInviteBox}>
                <Text style={[styles.pendingTitle, { color: palette.text }]}>Pending invites</Text>
                {(group.pendingInvites ?? []).map((invite) => (
                  <Text key={invite.id} style={[styles.pendingText, { color: palette.muted }]}>
                    {invite.name} · {invite.status}{invite.contact !== 'Contact not provided' ? ` · ${invite.contact}` : ''}
                  </Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/auction', params: { groupId: group.id } })}
              style={[styles.auctionButton, { backgroundColor: palette.primarySoft }]}
            >
              <Text style={[styles.auctionButtonText, { color: palette.primary }]}>
                {group.auctions.length > 0 ? 'Continue chit · Auction & reports' : 'Start round 1 · Record contributions'}
              </Text>
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Delete ${group.name}`}
                style={[styles.deleteButton, { borderColor: palette.danger }]}
                onPress={() => setGroupToDelete(group)}
              >
                <Text style={[styles.deleteButtonText, { color: palette.danger }]}>Delete group</Text>
              </TouchableOpacity>
            )}
          </View>
          );
        })}
        {publicGroups.length > 0 && (
          <>
            <Text style={[styles.discoverTitle, { color: palette.text }]}>Discover public groups</Text>
            <Text style={[styles.discoverDescription, { color: palette.muted }]}>
              Public listings show group information only. Member records, invitations, and finances stay private.
            </Text>
            {publicGroups.map((group) => (
              <View key={group.id} style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.groupName, { color: palette.text }]}>{group.name}</Text>
                  <Text style={[styles.badge, { color: palette.primary, backgroundColor: palette.primarySoft }]}>Public</Text>
                </View>
                <Text style={[styles.groupDescription, { color: palette.muted }]}>{group.description}</Text>
                <Text style={[styles.publicMeta, { color: palette.muted }]}>Join policy: contact group admin</Text>
              </View>
            ))}
          </>
        )}
        {visibleGroups.length === 0 && publicGroups.length === 0 && (
          <View style={[styles.emptyGroups, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.emptyGroupsTitle, { color: palette.text }]}>No groups yet</Text>
            <Text style={[styles.discoverDescription, { color: palette.muted }]}>
              Create a private circle or invite people to a public group. New group due dates default to day 30.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { backgroundColor: palette.header, borderColor: palette.border }]}>
        <NavItem label="Home" active={false} onPress={() => router.push('/')} palette={palette} />
        <NavItem label="Groups" active onPress={() => router.push('/groups')} palette={palette} />
        <NavItem label="Payments" active={false} onPress={() => router.push('/payments')} palette={palette} />
        <NavItem label="Activity" active={false} onPress={() => router.push('/activity')} palette={palette} />
        <NavItem label="Profile" active={false} onPress={() => router.push('/profile')} palette={palette} />
      </View>
      <Modal
        visible={groupToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGroupToDelete(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.confirmCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.confirmTitle, { color: palette.text }]}>Delete this group?</Text>
            <Text style={[styles.confirmCopy, { color: palette.muted }]}>
              {groupToDelete?.name} and its local member, payment and activity records will be removed from this device. This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: palette.border }]}
                onPress={() => setGroupToDelete(null)}
              >
                <Text style={{ color: palette.text, fontWeight: '700' }}>Keep group</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteButton, { backgroundColor: palette.danger }]}
                onPress={() => {
                  if (groupToDelete) deleteGroup(groupToDelete.id);
                  setGroupToDelete(null);
                }}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function InfoBubble({ label, value, palette }: { label: string; value: string; palette: typeof lightColors }) {
  return (
    <View style={[styles.infoBubble, { backgroundColor: palette.softBg }]}>
      <Text style={[styles.infoLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function createEmptyInvitees(count: number): InviteeDraft[] {
  return Array.from({ length: count }, () => ({ name: '', contact: '' }));
}

function resizeInvitees(invitees: InviteeDraft[], count: number): InviteeDraft[] {
  return Array.from({ length: count }, (_, index) => invitees[index] ?? { name: '', contact: '' });
}

function getChitTypeLabel(type: ChitType | undefined): string {
  if (type === 'fixed-discount') return 'Fixed discount';
  if (type === 'lucky-draw') return 'Lucky draw';
  return 'Auction';
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && /^\+?[\d\s().-]+$/.test(value);
}

function NavItem({ label, active, onPress, palette }: { label: string; active: boolean; onPress: () => void; palette: typeof lightColors }) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navText, { color: active ? palette.primary : palette.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const lightColors = {
  bg: '#f5f5f1',
  card: '#ffffff',
  header: '#f6f8f4',
  border: '#e3e7df',
  primary: '#1b7f6a',
  danger: '#b8413a',
  primarySoft: '#dff5ee',
  softBg: '#eef3f0',
  text: '#17212b',
  muted: '#54606d',
};

const darkColors = {
  bg: '#111827',
  card: '#1a2333',
  header: '#131d2a',
  border: '#2c3a4d',
  primary: '#7ae4c5',
  danger: '#ff938b',
  primarySoft: '#103a31',
  softBg: '#1d2d3f',
  text: '#edf5ff',
  muted: '#a4b0bf',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 100 },
  header: { fontSize: 28, fontWeight: '700', marginBottom: 14 },
  card: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  helperText: { fontSize: 12, lineHeight: 18, marginTop: -4, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 12 },
  choiceStack: { gap: 8, marginBottom: 12 },
  methodChoice: { borderWidth: 1, borderRadius: 12, padding: 12 },
  methodTitle: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 10 },
  ownerInitials: { width: 34, height: 34, borderRadius: 17, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', marginRight: 10, fontSize: 11, fontWeight: '800' },
  inviteeCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  inviteeTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segmentButton: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontWeight: '700', textTransform: 'capitalize' },
  doubleRow: { flexDirection: 'row', gap: 10 },
  fieldWrap: { flex: 1 },
  planCard: { borderRadius: 16, padding: 14, marginBottom: 14 },
  planTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  planLabel: { flex: 1, fontSize: 12, lineHeight: 17 },
  planValue: { fontSize: 14, fontWeight: '800', textAlign: 'right' },
  planNote: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  planWarning: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 8 },
  rowAdd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallButton: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  smallButtonText: { color: '#fff', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  primaryButton: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  errorText: { color: '#b8413a', fontSize: 12, marginTop: 4, marginBottom: 8 },
  primaryText: { color: '#fff', fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  groupName: { fontSize: 18, fontWeight: '700' },
  groupDescription: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  discoverTitle: { fontSize: 19, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  discoverDescription: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  publicMeta: { fontSize: 12, marginTop: 12 },
  emptyGroups: { borderWidth: 1, borderRadius: 18, padding: 18, marginBottom: 14 },
  emptyGroupsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  infoBubble: { width: '48%', borderRadius: 12, padding: 10 },
  infoLabel: { fontSize: 10, marginBottom: 4, textTransform: 'uppercase' },
  infoValue: { fontSize: 12, fontWeight: '700' },
  memberList: { marginTop: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 8 },
  memberInitials: { width: 28, height: 28, borderRadius: 14, marginRight: 10, textAlign: 'center', lineHeight: 28, fontSize: 12, fontWeight: '700' },
  memberName: { fontSize: 14, fontWeight: '700' },
  memberStatus: { marginTop: 2, fontSize: 11 },
  pendingInviteBox: { marginTop: 12, borderRadius: 12, padding: 10, backgroundColor: '#f8f4eb' },
  pendingTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  pendingText: { fontSize: 12, marginTop: 2 },
  auctionButton: { minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  auctionButtonText: { fontSize: 13, fontWeight: '800' },
  deleteButton: { borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 10, marginTop: 12 },
  deleteButtonText: { fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(10, 16, 20, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  confirmCard: { width: '100%', maxWidth: 420, borderRadius: 22, borderWidth: 1, padding: 20 },
  confirmTitle: { fontSize: 20, fontWeight: '800' },
  confirmCopy: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmDeleteButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmDeleteText: { color: '#ffffff', fontWeight: '800' },
  bottomNav: { position: 'absolute', left: 14, right: 14, bottom: 16, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, fontWeight: '700' },
});
