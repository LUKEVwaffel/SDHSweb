export function invitationMatchesAddition(change:Record<string,any>|null,guest:Record<string,any>,signupId:string){
 return !!change&&change.action==='add_guest'&&change.status==='applied'&&change.signup_id===signupId&&change.result?.guest_id===guest.id&&change.result?.date_email===guest.personal_email;
}
