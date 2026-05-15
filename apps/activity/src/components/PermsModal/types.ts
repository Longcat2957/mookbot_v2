export interface DiagPerms {
	operatorRoleName: string;
	resolvedOperatorRoleId: string | null;
	guildRoles: { id: string; name: string }[];
	memberRoles: string[];
	memberFetchOk: boolean;
	canEdit: boolean;
}
