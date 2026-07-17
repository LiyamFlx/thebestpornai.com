import dns from "dns";

dns.lookup("google.com", (err, address, family) => {
  console.log("google.com lookup:", err || address);
});

dns.lookup("b281e1d5ecb94a148bd620f8a2fe9d55.r2.cloudflarestorage.com", (err, address, family) => {
  console.log("r2 lookup:", err || address);
});
