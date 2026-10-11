/** Browser-only dependency fixture. Never writes app/auth source or sends credentials. */
async function installAuthFixture(context){
  await context.addInitScript(()=>localStorage.setItem('shh_ai_consent','2026-10-11'))
  await context.route('**/assets/index-*.js',async route=>{
    const response=await route.fetch(),js=await response.text(),marker=js.indexOf('Please sign in to use AI features.'),start=js.lastIndexOf('async function ',marker)
    if(marker<0||start<0)throw Error('Cannot identify local AI transport for fixture')
    const original=js.slice(start,marker),changed=original.replace('{data:{session:null}}','{data:{session:{access_token:"local-browser-fixture"}}}')
    if(changed===original)throw Error('Fixture expects unconfigured local cloud build; refuses to alter a configured account')
    await route.fulfill({response,body:js.slice(0,start)+changed+js.slice(marker),headers:{...response.headers(),'cache-control':'no-store'}})
  })
}
module.exports={installAuthFixture}
