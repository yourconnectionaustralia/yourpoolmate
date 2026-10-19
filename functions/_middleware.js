export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === "www.yourpoolmate.com.au") {
    url.hostname = "yourpoolmate.com.au";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
