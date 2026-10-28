import type { Group } from '../types';

export function isGroupMember(group: Group, userId: string, userName: string): boolean {
  return group.members.some(
    (member) => member.userId === userId || (!member.userId && member.name === userName),
  );
}

export function canManageGroup(group: Group, userId: string, userName: string): boolean {
  return group.members.some(
    (member) =>
      (member.userId === userId || (!member.userId && member.name === userName))
      && (member.role === 'primary-admin' || member.role === 'admin'),
  );
}

export function getMemberGroups(groups: Group[], userId: string, userName: string): Group[] {
  return groups.filter((group) => isGroupMember(group, userId, userName));
}
