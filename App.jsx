import { useState, useEffect } from "react";
import "./App.css";

const usePreventBackNavigation = () => {
  useEffect(() => {
      window.history.pushState(null, "", window.location.href);
      const preventGoBack = () => {
          window.history.pushState(null, "", window.location.href);
      };
      window.addEventListener("popstate", preventGoBack);
      return () => window.removeEventListener("popstate", preventGoBack);
  }, []);
};


const Signin = () => {
  usePreventBackNavigation();
  const [view, setView] = useState("buttons"); // 상태: "buttons", "signup", "signin", "signout"
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);


  //페이지 로드할 때 로그인 상태 확인해야함
  useEffect(() => {
    const token = localStorage.getItem("token");
    const signinusername = localStorage.getItem("username");

    if (token && signinusername) {
      setUsername(signinusername);
      setView("buttons"); // 로그인 상태로 버튼을 변경
    }
  }, []);

  const handleSignin = async (e) => {
    e.preventDefault();
    const response = await fetch("http://localhost:5000/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    console.log("Response Data:", data);
    if (response.ok && data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);

      alert("Login successful!");
      setView("buttons");
      setUsername(data.username);
      setEmail("");
      setPassword("");
    } else {
      alert("비밀번호를 확인해주세요");
    }
  };
  const handleRequestVerificationCode = async () => {
    try {
      const response = await fetch("http://localhost:5000/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (response.ok) {
        alert("인증번호가 이메일로 전송되었습니다.");
        setIsEmailSent(true);
      } else {
        alert("이메일 전송 실패: " + data.error);
      }
    } catch (error) {
      console.error("Error sending verification code:", error);
    }
  }
  const handleVerifyCode = async () => {
    const response = await fetch("http://localhost:5000/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code : verificationCode }),
    });
    const data = await response.json();
    if (response.ok) {
      alert("인증이 완료되었습니다.");
      setIsVerified(true);
    } else {
      alert("인증번호가 맞지 않습니다: " + data.error);
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault();

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!username || !email || !password) {
      alert("프론트:모든 정보를 입력해주세요!");
      return;
    }

    if (!passwordRegex.test(password)) {
      alert("프론트:비밀번호는 영문, 숫자, 특수문자를 포함하여 10자 이상이어야 합니다.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("프론트: 회원가입 성공!");
      } else {
        alert(data.error || "프론트:회원가입에 실패했습니다.");
      }
    } catch (error) {
      console.error("React : Signup error:", error);
      alert("React:An error occurred. Please try again.");
    }
    setView("buttons"); // 초기 화면으로 돌아가기
    setEmail("");
    setUsername("");
    setPassword("");
    setIsEmailSent(false);
    setIsVerified(false);
    setVerificationCode("");
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername("");
    setView("buttons");
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("로그인 후 탈퇴할 수 있습니다.");
      return;
    }

    try {
      const response = await fetch("http://localhost:5000/delete", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`  // 토큰을 Authorization 헤더에 첨부
        },
      });

      const data = await response.json();
      if (response.ok) {
        alert("회원 탈퇴가 완료되었습니다.");
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        setUsername("");
        setView("buttons");  // 탈퇴 후 로그인 화면으로 돌아가기
      } else {
        alert(data.error || "회원 탈퇴에 실패했습니다.");
      }
    } catch (error) {
      console.error("회원 탈퇴 에러:", error);
      alert("서버 오류가 발생했습니다.");
    }
  };

  return (
    <div className="auth-container">
      {localStorage.getItem("token") ? (
        <div>
          <h2>hello {username}님</h2>
          <button onClick={handleSignOut}>Sign Out</button>
          <button onClick={handleDeleteAccount}>Delete Account</button>
        </div>
      ) : (
        <>
          {view === "buttons" && (
            <div>
              <button onClick={() => setView("signup")}>Sign Up</button>
              <button onClick={() => setView("signin")}>Sign In</button>
            </div>
          )}
        </>
      )
      }
      {view === "signup" && (
        <div>
          <h2>Sign Up</h2>

          {/* Step 1: 이메일 입력 + 인증 요청 */}
          {!isEmailSent && !isVerified && (
            <>
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button onClick={handleRequestVerificationCode}>인증번호 전송</button>
            </>
          )}

          {/* Step 2: 인증번호 입력 */}
          {isEmailSent && !isVerified && (
            <>
              <input
                type="text"
                placeholder="인증 코드 입력"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
              <button onClick={handleVerifyCode}>완료</button>
            </>
          )}

          {/* Step 3: 인증 완료 후 회원가입 */}
          {isVerified && (
            <form onSubmit={handleSignup}>
              <input type="email" value={email} disabled /> {/* 이메일 수정 불가 */}
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit">Sign Up</button>
            </form>
          )}
        </div>
      )}

      {view === "signin" && (
        <form onSubmit={handleSignin}>
          <h2>Sign In</h2>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit">Sign in</button>
          <button onClick={() => setView("buttons")}>Back</button>
        </form>
      )}
    </div>
  );
};

export default Signin;
